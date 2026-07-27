import Alpine from 'alpinejs'
import { supabase } from '../src/js/config/supabase.js'
import sidebarHtml from './sidebar.html?raw'
import { getBooks, getCategories, createCategory, createBook, updateBook, createBookCopy, updateBookCopyCondition, bookCodeExists, isbnExists, normalizeIsbn, deleteBook, deleteBookCopy } from '../src/js/services/books.js'
import { uploadBookCover, deleteBookCover } from '../src/js/services/bookCovers.js'
import { getUsers } from '../src/js/services/users.js'
import { getBcpLogs } from '../src/js/services/bcp.js'

Alpine.data('staffApp', () => ({
  currentUser: null,
  activeSection: 'dashboard', // 'dashboard', 'books', 'borrowings', 'bcp', 'users', 'banners'
  borrowSubTab: 'records', // 'records' (รายการยืม-คืน) or 'fines' (จัดการค่าปรับ & สลิป)
  
  showToast(message, type = 'success') {
    // Simple toast notification fallback
    const toast = document.createElement('div')
    toast.style.cssText = `
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981'};
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: sans-serif;
      font-weight: bold;
      transition: opacity 0.3s ease;
    `
    toast.textContent = message
    document.body.appendChild(toast)
    setTimeout(() => {
      toast.style.opacity = '0'
      setTimeout(() => toast.remove(), 300)
    }, 3000)
  },
  
  // Modals Visibility
  showAddBookModal: false,
  showEditBookModal: false,
  showAddCategoryModal: false,
  showCopiesModal: false,
  showBarcodeModal: false,

  // Live Database Cache
  categories: [],
  booksList: [],
  selectedCategoryId: '',
  bookSearchQuery: '',
  bookViewMode: 'table',
  defaultCoverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
  coverUploadFile: null,
  coverPreviewUrl: '',
  coverUploadError: '',
  originalCoverUrl: '',

  newCategoryForm: {
    name: '',
    description: ''
  },

  // Form states
  newBookForm: {
    book_code: '',
    isbn: '',
    title: '',
    author: '',
    publisher: '',
    book_type: 'ทั่วไป',
    subject: '',
    import_date: '',
    page_count: '',
    description: '',
    cover_url: '',
    category_id: ''
  },

  editBookForm: {
    id: '',
    book_code: '',
    isbn: '',
    title: '',
    author: '',
    publisher: '',
    book_type: 'ทั่วไป',
    subject: '',
    import_date: '',
    page_count: '',
    description: '',
    cover_url: '',
    category_id: ''
  },

  selectedBookForCopies: null,
  newCopyForm: {
    copy_code: '',
    status: 'available',
    condition: 'ดีมาก',
    notes: ''
  },

  // Restock states
  showRestockModal: false,
  restockSearchQuery: '',
  foundRestockBook: null,
  restockQuantity: 1,
  restockCondition: 'ดีมาก',
  restockErrorMsg: '',

  // Barcode print states
  barcodeSelectedBookId: '',
  barcodeAvailableCopies: [],
  barcodeSelectedCopyIds: [],
  barcodeBookSearch: '',
  barcodePaperSize: 'a4',
  barcodeCustomPaperW: 210,
  barcodeCustomPaperH: 297,
  barcodeLabelWidth: 50,   // mm
  barcodeLabelHeight: 30,  // mm
  barcodeBarHeight: 40,    // px (svg internal)
  barcodeFontSize: 11,     // px (svg internal)
  barcodeShowTitle: true,

  // Staff Return & Fine Admin Override State
  staffReturnModalItem: null,
  staffReturnForm: {
    damage_type: 'none', // 'none' | 'minor' | 'major' | 'lost' | 'custom'
    custom_damage_fine: 0,
    damage_notes: ''
  },
  
  // Dedicated Fine Management & Slip Inspection State
  finesFilter: 'all', // 'all' | 'pending_approval' | 'pending' | 'paid'
  finesSearchQuery: '',
  inspectSlipModalItem: null,
  staffCustomFineModalItem: null,
  staffCustomFineForm: {
    damage_type: 'none',
    custom_damage_fine: 0,
    damage_notes: ''
  },

  // ═══════════════════════════════════════════════════
  // BANNER & ANNOUNCEMENT MANAGEMENT
  // ═══════════════════════════════════════════════════
  bannersList: [],
  bannerPreviewItem: null,
  showAddBannerModal: false,
  showEditBannerModal: false,
  showBannerPreviewModal: false,
  bannerTab: 'banner', // 'banner' or 'announcement'
  newBannerForm: { id: null, title: '', subtitle: '', badge: '', image: '', section: 'books' },
  bannerImageUploadFile: null,
  bannerImagePreviewUrl: '',
  bannerImageUploadError: '',
  draggedBannerId: null,

  get displayBanners() {
    if (this.bannerTab === 'announcement') {
      return this.bannersList.filter(b => b.section === 'announcement').sort((a,b) => (a.sort_order||0) - (b.sort_order||0))
    }
    return this.bannersList.filter(b => b.section !== 'announcement').sort((a,b) => (a.sort_order||0) - (b.sort_order||0))
  },

  async loadBanners() {
    try {
      if (typeof supabase !== 'undefined' && supabase) {
        const { data, error } = await supabase
          .from('banners')
          .select('*')
          .order('sort_order', { ascending: true })

        if (!error && data) {
          this.bannersList = data
          return
        }
      }
      const stored = localStorage.getItem('bcp_banners')
      if (stored) this.bannersList = JSON.parse(stored)
      else this.bannersList = []
    } catch (e) {
      this.bannersList = []
    }
  },

  _saveBanners() {
    localStorage.setItem('bcp_banners', JSON.stringify(this.bannersList))
  },

  openBannerPreview(banner) {
    this.bannerPreviewItem = banner
    this.showBannerPreviewModal = true
  },
  closeBannerPreview() {
    this.bannerPreviewItem = null
    this.showBannerPreviewModal = false
  },

  openAddBannerModal() {
    this.newBannerForm = { 
      id: null, 
      title: '', 
      subtitle: '', 
      badge: '🆕 ใหม่', 
      image: '', 
      section: this.bannerTab === 'announcement' ? 'announcement' : 'books',
      expires_at: ''
    }
    this.bannerImagePreviewUrl = ''
    this.bannerImageUploadFile = null
    this.bannerImageUploadError = ''
    this.showAddBannerModal = true
  },
  closeAddBannerModal() {
    this.showAddBannerModal = false
  },

  openEditBannerModal(banner) {
    let expFormatted = ''
    if (banner.expires_at) {
      try {
        expFormatted = new Date(banner.expires_at).toISOString().slice(0, 16)
      } catch (e) {}
    }
    this.newBannerForm = { ...banner, expires_at: expFormatted }
    this.bannerImagePreviewUrl = banner.image
    this.bannerImageUploadFile = null
    this.bannerImageUploadError = ''
    this.showEditBannerModal = true
  },
  closeEditBannerModal() {
    this.showEditBannerModal = false
  },

  handleBannerImageInput(event) {
    const file = event.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      this.bannerImageUploadError = 'กรุณาเลือกไฟล์รูปภาพเท่านั้น'
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      this.bannerImageUploadError = 'ขนาดไฟล์ต้องไม่เกิน 5 MB'
      return
    }
    this.bannerImageUploadError = ''
    this.bannerImageUploadFile = file
    const reader = new FileReader()
    reader.onload = (e) => {
      this.bannerImagePreviewUrl = e.target.result
      this.newBannerForm.image = e.target.result
    }
    reader.readAsDataURL(file)
  },

  async saveBanner() {
    if (!this.newBannerForm.title.trim()) {
      this.showToast('กรุณาระบุชื่อ', 'error')
      return
    }
    if (!this.newBannerForm.image.trim()) {
      this.showToast('กรุณาอัปโหลดรูปภาพ', 'error')
      return
    }

    let finalImageUrl = this.newBannerForm.image.trim()
    const isEdit = !!this.newBannerForm.id

    // Upload New Image
    if (this.bannerImageUploadFile && typeof supabase !== 'undefined' && supabase) {
      const file = this.bannerImageUploadFile
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `braners/${fileName}`
      
      const { error: uploadError } = await supabase.storage.from('Ant-Bcp-library-media').upload(filePath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false
      })
      if (uploadError) {
        console.error('Upload Error:', uploadError)
        this.showToast('อัปโหลดรูปภาพผิดพลาด: ' + uploadError.message, 'error')
        return
      }
      
      const { data: publicUrlData } = supabase.storage.from('Ant-Bcp-library-media').getPublicUrl(filePath)
      finalImageUrl = publicUrlData.publicUrl

      // Delete old image if editing
      if (isEdit) {
        const oldBanner = this.bannersList.find(b => b.id === this.newBannerForm.id)
        if (oldBanner && oldBanner.image && oldBanner.image.includes('Ant-Bcp-library-media/braners/')) {
          const oldPath = oldBanner.image.split('Ant-Bcp-library-media/')[1].split('?')[0]
          await supabase.storage.from('Ant-Bcp-library-media').remove([oldPath])
        }
      }
    }

    const payload = {
      title: this.newBannerForm.title.trim(),
      subtitle: this.newBannerForm.subtitle.trim(),
      badge: this.newBannerForm.badge.trim(),
      image: finalImageUrl,
      section: this.newBannerForm.section || 'books',
      expires_at: this.newBannerForm.expires_at ? new Date(this.newBannerForm.expires_at).toISOString() : null
    }

    if (typeof supabase !== 'undefined' && supabase) {
      if (isEdit) {
        const { data, error } = await supabase.from('banners').update(payload).eq('id', this.newBannerForm.id).select()
        if (!error && data && data.length > 0) {
          const idx = this.bannersList.findIndex(b => b.id === this.newBannerForm.id)
          if (idx !== -1) this.bannersList[idx] = data[0]
          this._saveBanners()
          this.closeEditBannerModal()
          this.showToast(`✅ แก้ไขเรียบร้อย`, 'success')
          return
        }
      } else {
        const maxSort = this.displayBanners.reduce((max, b) => Math.max(max, b.sort_order || 0), 0)
        payload.sort_order = maxSort + 1
        
        const { data, error } = await supabase.from('banners').insert([payload]).select()
        if (!error && data && data.length > 0) {
          this.bannersList.push(data[0])
          this._saveBanners()
          this.closeAddBannerModal()
          this.showToast(`✅ เพิ่มเรียบร้อย`, 'success')
          return
        }
      }
    } else {
      if (isEdit) {
        const idx = this.bannersList.findIndex(b => b.id === this.newBannerForm.id)
        if (idx !== -1) this.bannersList[idx] = { ...this.bannersList[idx], ...payload }
        this.closeEditBannerModal()
      } else {
        payload.id = Date.now()
        payload.sort_order = this.displayBanners.length + 1
        this.bannersList.push(payload)
        this.closeAddBannerModal()
      }
      this._saveBanners()
      this.showToast(`✅ สำเร็จ`, 'success')
    }
  },

  async deleteBanner(banner) {
    if (!confirm(`ยืนยันการลบ "${banner.title}" ?`)) return
    if (typeof supabase !== 'undefined' && supabase && banner.id) {
      try {
        await supabase.from('banners').delete().eq('id', banner.id)
        if (banner.image && banner.image.includes('Ant-Bcp-library-media/braners/')) {
          const filePath = banner.image.split('Ant-Bcp-library-media/')[1].split('?')[0]
          await supabase.storage.from('Ant-Bcp-library-media').remove([filePath])
        }
      } catch (e) {}
    }
    this.bannersList = this.bannersList.filter(b => b.id !== banner.id)
    this._saveBanners()
    this.showToast(`🗑️ ลบเรียบร้อย`, 'warning')
  },

  onBannerDragStart(event, banner) {
    this.draggedBannerId = banner.id
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', banner.id)
  },
  onBannerDragOver(event) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  },
  async onBannerDrop(event, targetBanner) {
    event.preventDefault()
    if (this.draggedBannerId === targetBanner.id) return

    const list = this.displayBanners
    const fromIdx = list.findIndex(b => b.id === this.draggedBannerId)
    const toIdx = list.findIndex(b => b.id === targetBanner.id)
    
    if (fromIdx === -1 || toIdx === -1) return

    const draggedItem = list[fromIdx]
    list.splice(fromIdx, 1)
    list.splice(toIdx, 0, draggedItem)

    list.forEach((b, idx) => {
      b.sort_order = idx + 1
    })

    list.forEach(updatedBanner => {
      const mainIdx = this.bannersList.findIndex(b => b.id === updatedBanner.id)
      if (mainIdx !== -1) {
        this.bannersList[mainIdx].sort_order = updatedBanner.sort_order
      }
    })

    this._saveBanners()

    if (typeof supabase !== 'undefined' && supabase) {
      const updates = list.map(b => ({ id: b.id, sort_order: b.sort_order }))
      const { error } = await supabase.rpc('update_banners_sort_order', { banner_orders: updates })
      if (error) {
        this.showToast('อัปเดตลำดับในฐานข้อมูลล้มเหลว', 'error')
      } else {
        this.showToast('จัดเรียงลำดับใหม่แล้ว', 'success')
      }
    }
    this.draggedBannerId = null
  },

  resetBannersToDefault() {
    if (!confirm('รีเซ็ตแบนเนอร์กลับเป็นค่าเริ่มต้น? การเปลี่ยนแปลงทั้งหมดจะหายไป')) return
    this.bannersList = []
    this._saveBanners()
    this.showToast('♻️ รีเซ็ตแบนเนอร์เรียบร้อยแล้ว', 'success')
  },


  // Borrowing Detailed Log & Audit Inspector Modal State
  inspectBorrowDetailItem: null,

  openInspectBorrowDetailModal(borrow) {
    if (!borrow) return
    this.inspectBorrowDetailItem = {
      ...borrow,
      exact_borrow_time: borrow.exact_borrow_time || (borrow.borrowDate ? borrow.borrowDate + ' เวลา 09:30:15 น.' : '20 ก.ค. 2026 เวลา 09:30:15 น.'),
      exact_due_time: borrow.exact_due_time || (borrow.dueDate ? borrow.dueDate + ' เวลา 17:00:00 น.' : '27 ก.ค. 2026 เวลา 17:00:00 น.'),
      exact_return_time: borrow.exact_return_time || (borrow.returnDate ? borrow.returnDate + ' เวลา 14:22:10 น.' : null),
      renewal_count: borrow.renewal_count !== undefined ? borrow.renewal_count : (borrow.last_renewed_at ? 1 : 0),
      last_renewed_at: borrow.last_renewed_at || (borrow.renewal_count > 0 ? '24 ก.ค. 2026 เวลา 11:14:05 น.' : null)
    }
  },

  // Member Profile Audit Inspector Modal State
  inspectMemberDetailItem: null,
  activeMemberSubTab: 'overview', // 'overview' | 'active_loans' | 'fines'

  async openMemberDetailModal(borrowOrUser, initialTab = 'overview') {
    if (!borrowOrUser) return

    const memberName = borrowOrUser.memberName || borrowOrUser.name || 'ไม่ระบุชื่อ'
    const memberBorrowings = (this.borrowingsList || []).filter(b => b.memberName === memberName)

    let userObj = {
      full_name: memberName,
      user_code: borrowOrUser.user_code || 'STD-460068',
      email: borrowOrUser.email || 'student@bcp.ac.th',
      phone_mobile: borrowOrUser.phone_mobile || '081-234-5678',
      line_id: borrowOrUser.line_id || '@student_bcp',
      address_current: borrowOrUser.address_current || '123 วิทยาลัยเทคโนโลยี Ant BCP กทม.',
      user_type: borrowOrUser.user_type || 'นักศึกษา',
      education_level: borrowOrUser.education_level || 'ปวช.2',
      department_major: borrowOrUser.department_major || 'เทคโนโลยีสารสนเทศ',
      group_section: borrowOrUser.group_section || 'IT.66/1',
      advisor_name: borrowOrUser.advisor_name || 'อ.สมชาย ใจดี',
      guardian_name: borrowOrUser.guardian_name || 'นายประเสริฐ สุขสันต์',
      guardian_relation: borrowOrUser.guardian_relation || 'บิดา',
      guardian_phone: borrowOrUser.guardian_phone || '089-999-8888',
      credit_score: borrowOrUser.credit_score !== undefined ? borrowOrUser.credit_score : 100,
      trust_level: borrowOrUser.trust_level || 'General',
      active_borrowings: memberBorrowings.filter(b => b.status === 'borrowed' || b.status === 'overdue'),
      fines_history: memberBorrowings.filter(b => Number(b.fine_amount) > 0 || b.fine_status !== 'none'),
      active_borrowings_count: memberBorrowings.filter(b => b.status === 'borrowed' || b.status === 'overdue').length,
      total_fines_pending: memberBorrowings.filter(b => b.fine_status === 'pending' || b.fine_status === 'pending_approval').reduce((sum, b) => sum + (Number(b.fine_amount) || 0), 0)
    }

    if (typeof supabase !== 'undefined' && supabase && (borrowOrUser.user_id || borrowOrUser.id)) {
      try {
        const uId = borrowOrUser.user_id || borrowOrUser.id
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', uId)
          .single()

        if (!error && data) {
          userObj = { ...userObj, ...data }
        }
      } catch (err) {
        console.warn('Error fetching detailed member profile from Supabase:', err)
      }
    }

    this.activeMemberSubTab = initialTab
    this.inspectMemberDetailItem = userObj
  },

  borrowingsList: [],
  borrowFilterCategory: 'all', // 'all', 'borrowed', 'overdue', 'returned'
  borrowSearchQuery: '',

  getFilteredBorrowings() {
    let list = this.borrowingsList || []
    if (this.borrowFilterCategory === 'borrowed') {
      list = list.filter(b => b.status === 'borrowed')
    } else if (this.borrowFilterCategory === 'overdue') {
      list = list.filter(b => b.status === 'overdue')
    } else if (this.borrowFilterCategory === 'returned') {
      list = list.filter(b => b.status === 'returned')
    }

    const query = (this.borrowSearchQuery || '').trim().toLowerCase()
    if (!query) return list

    return list.filter(item => {
      const target = [item.bookCode, item.bookTitle, item.memberName, item.borrowDate, item.dueDate, item.user_code].filter(Boolean).join(' ').toLowerCase()
      return target.includes(query)
    })
  },

  getBorrowingStats() {
    const list = this.borrowingsList || []
    return {
      total: list.length,
      borrowed: list.filter(b => b.status === 'borrowed').length,
      overdue: list.filter(b => b.status === 'overdue').length,
      returned: list.filter(b => b.status === 'returned').length
    }
  },

  navigateToFineManagement(borrow) {
    this.activeSection = 'borrowings'
    this.borrowSubTab = 'fines'
    if (borrow) {
      this.finesSearchQuery = borrow.bookCode || borrow.memberName || ''
    }
    this.showToast('🎯 นำทางไปยังศูนย์จัดการค่าปรับเรียบร้อยแล้ว', 'info')
  },

  getFilteredFines() {
    let list = this.borrowingsList || []
    list = list.filter(item => Number(item.fine_amount) > 0 || item.fine_status !== 'none')

    if (this.finesFilter === 'pending_approval') {
      list = list.filter(item => item.fine_status === 'pending_approval')
    } else if (this.finesFilter === 'pending') {
      list = list.filter(item => item.fine_status === 'pending')
    } else if (this.finesFilter === 'paid') {
      list = list.filter(item => item.fine_status === 'paid')
    }

    const query = (this.finesSearchQuery || '').trim().toLowerCase()
    if (!query) return list

    return list.filter(item => {
      const target = [item.bookCode, item.bookTitle, item.memberName, item.fine_amount, item.damage_notes].filter(Boolean).join(' ').toLowerCase()
      return target.includes(query)
    })
  },

  getFineStats() {
    const list = (this.borrowingsList || []).filter(item => Number(item.fine_amount) > 0 || item.fine_status !== 'none')
    return {
      total: list.length,
      pending_approval: list.filter(i => i.fine_status === 'pending_approval').length,
      pending: list.filter(i => i.fine_status === 'pending').length,
      paid: list.filter(i => i.fine_status === 'paid').length
    }
  },

  async approveFineSlip(borrow) {
    if (!borrow) return
    try {
      borrow.fine_status = 'paid'
      if (typeof supabase !== 'undefined' && supabase && borrow.supabase_id) {
        await supabase
          .from('borrowings')
          .update({ fine_status: 'paid' })
          .eq('id', borrow.supabase_id)
      }
      this.inspectSlipModalItem = null
      this.showToast(`✅ อนุมัติสลิปและยืนยันการชำระเงินค่าปรับ ${borrow.fine_amount} บาท เรียบร้อยแล้ว`, 'success')
    } catch (err) {
      console.error('Error approving fine slip:', err)
      this.showToast('เกิดข้อผิดพลาดในการอนุมัติสลิป', 'error')
    }
  },

  async rejectFineSlip(borrow) {
    if (!borrow) return
    try {
      borrow.fine_status = 'pending'
      if (typeof supabase !== 'undefined' && supabase && borrow.supabase_id) {
        await supabase
          .from('borrowings')
          .update({ fine_status: 'pending' })
          .eq('id', borrow.supabase_id)
      }
      this.inspectSlipModalItem = null
      this.showToast('❌ ปฏิเสธสลิปการโอนเงิน (แจ้งสมาชิกให้ส่งสลิปใหม่เรียบร้อย)', 'warning')
    } catch (err) {
      console.error('Error rejecting fine slip:', err)
      this.showToast('เกิดข้อผิดพลาดในการทำรายการ', 'error')
    }
  },

  async confirmCashFinePayment(borrow) {
    if (!borrow) return
    try {
      borrow.fine_status = 'paid'
      if (typeof supabase !== 'undefined' && supabase && borrow.supabase_id) {
        await supabase
          .from('borrowings')
          .update({ fine_status: 'paid' })
          .eq('id', borrow.supabase_id)
      }
      this.showToast(`💵 ยืนยันการรับชำระเงินสดจำนวน ${borrow.fine_amount || 0} บาท เรียบร้อยแล้ว`, 'success')
    } catch (err) {
      console.error('Error confirming cash payment:', err)
      this.showToast('เกิดข้อผิดพลาดในการบันทึกเงินสด', 'error')
    }
  },

  openStaffCustomFineModal(borrow) {
    this.staffCustomFineModalItem = borrow
    this.staffCustomFineForm = {
      damage_type: borrow.damage_type || 'none',
      custom_damage_fine: borrow.fine_amount || 0,
      damage_notes: borrow.damage_notes || ''
    }
  },

  async saveStaffCustomFine() {
    const borrow = this.staffCustomFineModalItem
    if (!borrow) return

    if (this.staffCustomFineForm.damage_type === 'custom' && !this.staffCustomFineForm.damage_notes) {
      this.showToast('⚠️ กรุณาระบุเหตุผล/รายละเอียดความเสียหายเมื่อ Admin คีย์ยอดเงินเอง', 'warning')
      return
    }

    try {
      let damageFine = 0
      const dType = this.staffCustomFineForm.damage_type
      if (dType === 'minor') damageFine = 50
      else if (dType === 'major') damageFine = 150
      else if (dType === 'lost') damageFine = 300
      else if (dType === 'custom') damageFine = Math.max(0, Number(this.staffCustomFineForm.custom_damage_fine) || 0)

      const totalFine = damageFine
      const fineStatus = totalFine > 0 ? 'pending' : 'none'

      borrow.fine_amount = totalFine
      borrow.fine_status = fineStatus
      borrow.damage_type = dType
      borrow.damage_notes = this.staffCustomFineForm.damage_notes

      if (typeof supabase !== 'undefined' && supabase && borrow.supabase_id) {
        await supabase
          .from('borrowings')
          .update({
            fine_amount: totalFine,
            fine_status: fineStatus,
            damage_type: dType,
            damage_notes: this.staffCustomFineForm.damage_notes || null
          })
          .eq('id', borrow.supabase_id)
      }

      this.staffCustomFineModalItem = null
      this.showToast(`✅ บันทึกยอดค่าปรับความเสียหาย ${totalFine} บาท เรียบร้อยแล้ว`, 'success')
    } catch (err) {
      console.error('Error saving custom fine:', err)
      this.showToast('เกิดข้อผิดพลาดในการบันทึกค่าปรับ', 'error')
    }
  },

  openStaffReturnModal(borrow) {
    this.staffReturnModalItem = borrow
    this.staffReturnForm = {
      damage_type: 'none',
      custom_damage_fine: 0,
      damage_notes: ''
    }
  },

  calculateStaffFine(borrow) {
    if (!borrow) return { overdueDays: 0, lateFine: 0, damageFine: 0, totalFine: 0 }
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const dueDate = new Date(borrow.dueDate)
    dueDate.setHours(0, 0, 0, 0)

    const diffMs = today - dueDate
    const overdueDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    const lateFine = overdueDays * 5 // 5 THB/day

    let damageFine = 0
    const damageType = this.staffReturnForm.damage_type
    if (damageType === 'minor') damageFine = 50
    else if (damageType === 'major') damageFine = 150
    else if (damageType === 'lost') damageFine = 300
    else if (damageType === 'custom') damageFine = Math.max(0, Number(this.staffReturnForm.custom_damage_fine) || 0)

    const totalFine = lateFine + damageFine
    return {
      overdueDays,
      lateFine,
      damageFine,
      totalFine
    }
  },

  async submitStaffReturn() {
    const borrow = this.staffReturnModalItem
    if (!borrow) return

    const fineInfo = this.calculateStaffFine(borrow)

    if (this.staffReturnForm.damage_type === 'custom' && !this.staffReturnForm.damage_notes) {
      this.showToast('⚠️ กรุณาระบุเหตุผล/รายละเอียดความเสียหายเมื่อ Admin เลือกคีย์ยอดเงินเอง', 'warning')
      return
    }

    try {
      const nowStr = new Date().toISOString()
      const fineStatus = fineInfo.totalFine > 0 ? 'pending' : 'none'

      // Update local borrowingsList state
      borrow.status = 'returned'
      borrow.returnDate = nowStr.split('T')[0]
      borrow.fine_amount = fineInfo.totalFine
      borrow.fine_status = fineStatus
      borrow.damage_type = this.staffReturnForm.damage_type
      borrow.damage_notes = this.staffReturnForm.damage_notes

      // Try update Supabase if borrowing id exists
      if (typeof supabase !== 'undefined' && supabase && borrow.supabase_id) {
        await supabase
          .from('borrowings')
          .update({
            status: 'returned',
            return_date: nowStr,
            damage_type: this.staffReturnForm.damage_type,
            fine_amount: fineInfo.totalFine,
            fine_status: fineStatus,
            damage_notes: this.staffReturnForm.damage_notes || null
          })
          .eq('id', borrow.supabase_id)
      }

      this.staffReturnModalItem = null
      this.showToast(`✅ บันทึกการตรวจรับคืนหนังสือสำเร็จ! ${fineInfo.totalFine > 0 ? '(บันทึกยอดค่าปรับ ' + fineInfo.totalFine + ' บาท)' : ''}`, 'success')
    } catch (err) {
      console.error('Error in staff return:', err)
      this.showToast('เกิดข้อผิดพลาดในการบันทึกรับคืนหนังสือ', 'error')
    }
  },

  bcpEvents: [],
  usersList: [],

  // User Management State & Actions
  showEditUserModal: false,
  editUserForm: {
    id: '',
    full_name: '',
    email: '',
    user_type: 'student',
    phone_mobile: '',
    department_major: '',
    status: 'active',
    new_password: ''
  },

  openEditUserModal(user) {
    this.editUserForm = {
      id: user.id,
      user_code: user.user_code || '',
      full_name: user.full_name || user.name || '',
      email: user.email || '',
      user_type: user.user_type || user.role || 'student',
      education_level: user.education_level || '',
      department_major: user.department_major || '',
      group_section: user.group_section || '',
      advisor_name: user.advisor_name || '',
      phone_mobile: user.phone_mobile || '',
      line_id: user.line_id || '',
      address_current: user.address_current || '',
      guardian_name: user.guardian_name || '',
      guardian_relation: user.guardian_relation || '',
      guardian_phone: user.guardian_phone || '',
      status: user.status || 'active',
      current_password: user.password || 'password123',
      show_current_password: false,
      new_password: ''
    }
    this.showEditUserModal = true
  },

  async saveEditUser() {
    if (!this.editUserForm.full_name.trim()) {
      this.showToast('กรุณากรอกชื่อ-นามสกุล', 'warning')
      return
    }

    const payload = {
      user_code: this.editUserForm.user_code.trim(),
      full_name: this.editUserForm.full_name.trim(),
      email: this.editUserForm.email.trim(),
      user_type: this.editUserForm.user_type,
      education_level: this.editUserForm.education_level.trim(),
      department_major: this.editUserForm.department_major.trim(),
      group_section: this.editUserForm.group_section.trim(),
      advisor_name: this.editUserForm.advisor_name.trim(),
      phone_mobile: this.editUserForm.phone_mobile.trim(),
      line_id: this.editUserForm.line_id.trim(),
      address_current: this.editUserForm.address_current.trim(),
      guardian_name: this.editUserForm.guardian_name.trim(),
      guardian_relation: this.editUserForm.guardian_relation.trim(),
      guardian_phone: this.editUserForm.guardian_phone.trim(),
      status: this.editUserForm.status
    }

    if (this.editUserForm.new_password.trim()) {
      payload.password = this.editUserForm.new_password.trim()
    }

    if (typeof supabase !== 'undefined' && supabase && this.editUserForm.id) {
      const { error } = await supabase
        .from('users')
        .update(payload)
        .eq('id', this.editUserForm.id)

      if (error) {
        console.error('Error updating user:', error)
        this.showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูลผู้ใช้: ' + error.message, 'error')
        return
      }
    }

    // Update local list
    const target = this.usersList.find(u => u.id === this.editUserForm.id)
    if (target) {
      Object.assign(target, payload)
      target.name = payload.full_name
      target.role = payload.user_type
      if (payload.password) {
        target.password = payload.password
      }
    }

    this.showEditUserModal = false
    this.showToast('✅ บันทึกข้อมูลและสิทธิ์สมาชิกเรียบร้อยแล้ว', 'success')
  },

  async toggleUserStatus(user) {
    const newStatus = user.status === 'active' ? 'suspended' : 'active'
    const actionName = newStatus === 'active' ? 'เปิดใช้งาน' : 'ระงับใช้งาน'
    if (!confirm(`คุณต้องการ ${actionName} บัญชีของ "${user.name || user.full_name}" หรือไม่?`)) return

    if (typeof supabase !== 'undefined' && supabase && user.id) {
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('id', user.id)

      if (error) {
        this.showToast('เกิดข้อผิดพลาด: ' + error.message, 'error')
        return
      }
    }

    user.status = newStatus
    this.showToast(`✅ ${actionName} บัญชีสมาชิกเรียบร้อยแล้ว`, 'success')
  },

  // Dynamic Dashboard Metrics
  get totalBooks() {
    return this.booksList.length
  },
  get activeLoans() {
    return this.borrowingsList.filter(b => b.status === 'borrowed' || b.status === 'overdue').length
  },
  get pendingBcpEvents() {
    return this.bcpEvents.filter(e => e.status === 'pending').length
  },
  get activeUsers() {
    return this.usersList.filter(u => u.status === 'active').length
  },

  // Helper getters for books/copies joined data
  getCopiesForBook(bookId) {
    const book = this.booksList.find(b => b.id === bookId)
    return book ? (book.book_copies || []) : []
  },

  getBookCopyCount(bookId) {
    return this.getCopiesForBook(bookId).filter(c => c.status !== 'lost').length
  },

  getBookStatusText(bookId) {
    const copies = this.getCopiesForBook(bookId)
    if (copies.length === 0) return 'ไม่มีเล่มย่อย'
    const available = copies.some(c => c.status === 'available')
    return available ? 'พร้อมยืม' : 'ยืมหมด'
  },

  getCategoryName(catId) {
    const cat = this.categories.find(c => c.id === catId)
    return cat ? cat.name : 'ทั่วไป'
  },

  getFilteredBooks() {
    const query = (this.bookSearchQuery || '').trim().toLocaleLowerCase()

    return this.booksList.filter(book => {
      const matchesCategory = !this.selectedCategoryId ||
        book.category_id === this.selectedCategoryId ||
        book.categories?.id === this.selectedCategoryId

      if (!matchesCategory) return false
      if (!query) return true

      const searchableText = [
        book.book_code,
        book.isbn,
        book.title,
        book.author,
        book.publisher,
        book.subject,
        book.categories?.name
      ].filter(Boolean).join(' ').toLocaleLowerCase()

      return searchableText.includes(query)
    })
  },

  getCategoryBookCount(categoryId) {
    return this.booksList.filter(book => book.category_id === categoryId || book.categories?.id === categoryId).length
  },

  openEditBook(book) {
    this.resetCoverUpload()
    this.originalCoverUrl = book.cover_url || ''
    this.editBookForm = {
      id: book.id,
      book_code: book.book_code || '',
      isbn: book.isbn || '',
      title: book.title || '',
      author: book.author || '',
      publisher: book.publisher || '',
      book_type: book.book_type || 'ทั่วไป',
      subject: book.subject || '',
      import_date: book.import_date || '',
      page_count: book.page_count || '',
      description: book.description || '',
      cover_url: book.cover_url || '',
      category_id: book.category_id || book.categories?.id || ''
    }
    this.showEditBookModal = true
  },

  resetCoverUpload() {
    if (this.coverPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.coverPreviewUrl)
    }
    document.querySelectorAll('.book-cover-file-input').forEach(input => {
      input.value = ''
    })
    this.coverUploadFile = null
    this.coverPreviewUrl = ''
    this.coverUploadError = ''
  },

  selectCoverFile(event) {
    const file = event.target.files?.[0]
    this.coverUploadError = ''

    if (!file) return
    if (!file.type.startsWith('image/')) {
      this.coverUploadError = 'กรุณาเลือกไฟล์รูปภาพเท่านั้น'
      event.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      this.coverUploadError = 'ไฟล์ปกหนังสือต้องมีขนาดไม่เกิน 5 MB'
      event.target.value = ''
      return
    }

    if (this.coverPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.coverPreviewUrl)
    }
    this.coverUploadFile = file
    this.coverPreviewUrl = URL.createObjectURL(file)
  },

  async resolveCoverUrl(form) {
    if (this.coverUploadFile) {
      return await uploadBookCover(this.coverUploadFile)
    }
    return form.cover_url.trim() || this.defaultCoverUrl
  },

  async saveEditedBook() {
    const form = this.editBookForm

    if (!form.title.trim() || !form.author.trim()) {
      alert('กรุณากรอกชื่อหนังสือและชื่อผู้แต่งให้ครบถ้วน')
      return
    }

    try {
      const coverUrl = await this.resolveCoverUrl(form)

      await updateBook(form.id, {
        title: form.title.trim(),
        author: form.author.trim(),
        publisher: form.publisher.trim() || null,
        book_type: form.book_type,
        subject: form.subject.trim() || null,
        import_date: form.import_date || null,
        page_count: parseInt(form.page_count) || null,
        description: form.description.trim() || null,
        cover_url: coverUrl,
        category_id: form.category_id || null
      })

      await this.loadDatabaseData()
      this.showEditBookModal = false
      let oldCoverDeleteError = null
      if (this.originalCoverUrl && this.originalCoverUrl !== coverUrl) {
        try {
          await deleteBookCover(this.originalCoverUrl)
        } catch (error) {
          oldCoverDeleteError = error
          console.error('Error deleting old book cover:', error)
        }
      }
      this.originalCoverUrl = ''
      this.resetCoverUpload()
      alert(oldCoverDeleteError
        ? `✅ แก้ไขข้อมูลหนังสือเรียบร้อยแล้ว แต่ลบรูปเก่าไม่สำเร็จ: ${oldCoverDeleteError.message}`
        : '✅ แก้ไขข้อมูลหนังสือเรียบร้อยแล้ว')
    } catch (err) {
      console.error('Error updating book:', err)
      if (err.code === '23505') {
        alert('❌ ISBN นี้ซ้ำกับข้อมูลในระบบ')
      } else {
        alert(`❌ ไม่สามารถแก้ไขข้อมูลหนังสือได้: ${err.message}`)
      }
    }
  },

  openAddCategory() {
    this.newCategoryForm = { name: '', description: '' }
    this.showAddCategoryModal = true
  },

  async saveCategory() {
    const name = this.newCategoryForm.name.trim()
    const description = this.newCategoryForm.description.trim() || null

    if (!name) {
      alert('กรุณาระบุชื่อหมวดหมู่')
      return
    }

    if (this.categories.some(category => category.name.trim().toLowerCase() === name.toLowerCase())) {
      alert(`❌ หมวดหมู่ "${name}" มีอยู่แล้วในระบบ`)
      return
    }

    try {
      const category = await createCategory({ name, description })
      await this.loadDatabaseData()
      this.newBookForm.category_id = category.id
      this.showAddCategoryModal = false
      alert(`✅ เพิ่มหมวดหมู่ "${name}" และเลือกให้หนังสือแล้ว`)
    } catch (err) {
      console.error('Error creating category:', err)
      if (err.code === '23505') {
        alert(`❌ หมวดหมู่ "${name}" มีอยู่แล้วในระบบ`)
      } else {
        alert(`❌ ไม่สามารถเพิ่มหมวดหมู่ได้: ${err.message}`)
      }
    }
  },

  // Load live data from Supabase
  async loadDatabaseData() {
    try {
      this.categories = await getCategories()
      this.booksList = await getBooks()

      if (typeof supabase !== 'undefined' && supabase) {
        // 1. Load borrowings
        const { data: bData, error: bErr } = await supabase
          .from('borrowings')
          .select(`
            id, borrow_date, due_date, return_date, status, renewal_count, last_renewed_at, damage_type, fine_amount, fine_status, damage_notes,
            users ( id, user_code, full_name, user_type, education_level, department_major, phone_mobile ),
            book_copies ( id, copy_code, condition, books ( title, book_code, author, cover_url ) )
          `)
          .order('borrow_date', { ascending: false })

        if (!bErr && bData) {
          this.borrowingsList = bData.map(item => ({
            id: item.id,
            supabase_id: item.id,
            bookCode: item.book_copies?.books?.book_code ? `${item.book_copies.books.book_code}-${item.book_copies.copy_code}` : (item.book_copies?.copy_code || 'N/A'),
            bookTitle: item.book_copies?.books?.title || 'ไม่ระบุชื่อ',
            author: item.book_copies?.books?.author || 'ไม่ระบุผู้แต่ง',
            memberName: item.users?.full_name || 'สมาชิกในระบบ',
            user_code: item.users?.user_code || 'N/A',
            user_type: item.users?.user_type || 'นักศึกษา',
            phone_mobile: item.users?.phone_mobile || 'ไม่ระบุ',
            borrowDate: item.borrow_date ? item.borrow_date.split('T')[0] : 'N/A',
            exact_borrow_time: item.borrow_date ? new Date(item.borrow_date).toLocaleString('th-TH') : 'N/A',
            dueDate: item.due_date ? item.due_date.split('T')[0] : 'N/A',
            exact_due_time: item.due_date ? new Date(item.due_date).toLocaleString('th-TH') : 'N/A',
            returnDate: item.return_date ? item.return_date.split('T')[0] : null,
            exact_return_time: item.return_date ? new Date(item.return_date).toLocaleString('th-TH') : null,
            status: item.status,
            renewal_count: item.renewal_count || 0,
            last_renewed_at: item.last_renewed_at ? new Date(item.last_renewed_at).toLocaleString('th-TH') : null,
            fine_amount: item.fine_amount || 0,
            fine_status: item.fine_status || 'none',
            damage_type: item.damage_type || 'none',
            damage_notes: item.damage_notes || '',
            cover_url: item.book_copies?.books?.cover_url || ''
          }))
        } else {
          this.borrowingsList = []
        }

        // 2. Load users
        try {
          const usersData = await getUsers()
          if (usersData) {
            this.usersList = usersData.map(u => ({
              ...u,
              id: u.id,
              name: u.full_name || u.name || 'ไม่ระบุชื่อ',
              full_name: u.full_name || u.name || 'ไม่ระบุชื่อ',
              email: u.email || 'ไม่ระบุอีเมล',
              role: u.user_type || u.role || 'member',
              user_type: u.user_type || u.role || 'member',
              status: u.status || 'active',
              user_code: u.user_code || '',
              phone_mobile: u.phone_mobile || '',
              department_major: u.department_major || '',
              password: u.password || 'password123'
            }))
          } else {
            this.usersList = []
          }
        } catch (uErr) {
          console.error('Error fetching users:', uErr)
          this.usersList = []
        }

        // 3. Load BCP logs
        try {
          const bcpLogs = await getBcpLogs()
          if (bcpLogs) {
            this.bcpEvents = bcpLogs.map(log => ({
              id: log.id,
              title: log.trigger_event || log.bcp_plans?.plan_title || 'แจ้งเหตุ BCP',
              reporter: log.users?.full_name || 'ไม่ระบุผู้แจ้ง',
              date: log.created_at ? log.created_at.split('T')[0] : 'N/A',
              status: log.status || 'pending',
              severity: log.bcp_plans?.priority || 'high',
              location: log.location || 'ระบบ BCP'
            }))
          } else {
            this.bcpEvents = []
          }
        } catch (bcpErr) {
          console.error('Error fetching BCP logs:', bcpErr)
          this.bcpEvents = []
        }

        // 4. Load Banners
        await this.loadBanners()
      }
    } catch (err) {
      console.error('Error loading database data:', err)
    }
  },

  // Book CRUD Actions (Live database)
  openAddBook() {
    this.resetCoverUpload()
    const usedCodes = this.booksList
      .map(book => book.book_code?.trim().toUpperCase())
      .filter(Boolean)

    const highestCode = usedCodes.reduce((highest, code) => {
      const match = code.match(/^BK-(\d+)$/)
      return match ? Math.max(highest, Number(match[1])) : highest
    }, 0)

    this.newBookForm = {
      // Use a readable sequence instead of a random 3-digit code.
      book_code: `BK-${String(highestCode + 1).padStart(6, '0')}`,
      isbn: '',
      title: '',
      author: '',
      publisher: '',
      book_type: 'ทั่วไป',
      subject: '',
      import_date: new Date().toISOString().split('T')[0],
      page_count: '',
      description: '',
      cover_url: '',
      category_id: this.categories[0]?.id || '',
      initial_copies: 1 // Default to 1 copy
    }
    this.showAddBookModal = true
  },

  async saveBook() {
    if (!this.newBookForm.book_code || !this.newBookForm.title || !this.newBookForm.author) {
      alert('กรุณากรอกข้อมูลสำคัญให้ครบถ้วน (รหัสหนังสือหลัก, ชื่อหนังสือ, ชื่อผู้แต่ง)')
      return
    }

    try {
      const bookCode = this.newBookForm.book_code.trim().toUpperCase()
      const isbn = normalizeIsbn(this.newBookForm.isbn)

      // Check the live database immediately before inserting. The database
      // UNIQUE constraint still protects against simultaneous submissions.
      if (await bookCodeExists(bookCode)) {
        alert(`❌ รหัสหนังสือ ${bookCode} ถูกใช้งานแล้ว กรุณาปิดฟอร์มแล้วเปิดใหม่อีกครั้ง`)
        return
      }

      if (isbn && await isbnExists(isbn)) {
        alert(`❌ ISBN ${isbn} มีอยู่ในระบบแล้ว กรุณาใช้เมนู "เพิ่มสต็อกหนังสือด้วย ISBN" เพื่อเพิ่มจำนวนเล่ม`)
        return
      }

      const coverUrl = await this.resolveCoverUrl(this.newBookForm)

      // 1. Prepare schema data
      const bookData = {
        book_code: bookCode,
        isbn: isbn || null,
        title: this.newBookForm.title.trim(),
        author: this.newBookForm.author.trim(),
        publisher: this.newBookForm.publisher.trim() || null,
        book_type: this.newBookForm.book_type,
        subject: this.newBookForm.subject.trim() || null,
        import_date: this.newBookForm.import_date || null,
        page_count: parseInt(this.newBookForm.page_count) || null,
        description: this.newBookForm.description.trim() || null,
        cover_url: coverUrl,
        category_id: this.newBookForm.category_id || null
      }

      // 2. Insert mother book record
      const insertedBook = await createBook(bookData)

      // 3. Loop insert child copy records matching initial_copies
      const initialCopies = parseInt(this.newBookForm.initial_copies) || 1
      for (let i = 1; i <= initialCopies; i++) {
        const copyCode = String(i).padStart(4, '0') // e.g. '0001', '0002'...
        await createBookCopy({
          book_id: insertedBook.id,
          copy_code: copyCode,
          status: 'available',
          condition: 'ดีมาก',
          notes: 'เล่มนำเข้าระบบเริ่มต้น'
        })
      }

      // 4. Refresh Cache & Close Modal
      await this.loadDatabaseData()
      this.showAddBookModal = false
      this.resetCoverUpload()
      alert(`🎉 บันทึกหนังสือหลักและเพิ่มเล่มย่อย ${initialCopies} เล่มสำเร็จ!`)
    } catch (err) {
      console.error('Error inserting book/copy:', err)
      if (err.code === '23505') {
        alert('❌ ISBN หรือรหัสหนังสือซ้ำกับข้อมูลในระบบ กรุณาตรวจสอบแล้วลองใหม่')
      } else {
        alert(`❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${err.message}`)
      }
    }
  },

  async deleteBook(bookId) {
    if (confirm('ยืนยันลบหนังสือนี้? เล่มย่อยทั้งหมดจะถูกลบออกด้วย (Foreign Key Cascade)')) {
      try {
        await deleteBook(bookId)
        await this.loadDatabaseData()
        alert('🗑️ ลบหนังสือหลักเรียบร้อยแล้ว')
      } catch (err) {
        console.error('Error deleting book:', err)
        alert(`❌ ไม่สามารถลบหนังสือได้: ${err.message}`)
      }
    }
  },

  // Copies Management Actions (Live database)
  openViewCopies(book) {
    this.selectedBookForCopies = book
    this.newCopyForm = {
      copy_code: '',
      status: 'available',
      condition: 'ดีมาก',
      notes: ''
    }
    
    // Auto generate next copy code from existing copies of selected book
    const existingCopies = this.getCopiesForBook(book.id)
    if (existingCopies.length > 0) {
      const lastCopyCode = existingCopies[existingCopies.length - 1].copy_code
      const nextNum = parseInt(lastCopyCode) + 1
      this.newCopyForm.copy_code = String(isNaN(nextNum) ? existingCopies.length + 1 : nextNum).padStart(4, '0')
    } else {
      this.newCopyForm.copy_code = '0001'
    }

    this.showCopiesModal = true
  },

  async saveCopy() {
    if (!this.newCopyForm.copy_code) {
      alert('กรุณาระบุรหัสเล่มย่อย (เช่น 0003)')
      return
    }

    const currentBookId = this.selectedBookForCopies.id
    
    // Check local duplicate check before submitting
    const existingCopies = this.getCopiesForBook(currentBookId)
    const isDuplicate = existingCopies.some(c => c.copy_code === this.newCopyForm.copy_code)
    if (isDuplicate) {
      alert('❌ รหัสเล่มย่อยนี้ซ้ำในระบบสำหรับหนังสือเล่มนี้แล้ว')
      return
    }

    try {
      await createBookCopy({
        book_id: currentBookId,
        copy_code: this.newCopyForm.copy_code.trim(),
        status: this.newCopyForm.status,
        condition: this.newCopyForm.condition.trim(),
        notes: this.newCopyForm.notes.trim()
      })

      // Refresh database cache
      await this.loadDatabaseData()
      
      // Update selected book reference to show newly added copy immediately in the modal
      this.selectedBookForCopies = this.booksList.find(b => b.id === currentBookId)

      // Auto prepare next code
      const updatedCopies = this.getCopiesForBook(currentBookId)
      const lastCopyCode = updatedCopies[updatedCopies.length - 1].copy_code
      const nextNum = parseInt(lastCopyCode) + 1
      this.newCopyForm.copy_code = String(isNaN(nextNum) ? updatedCopies.length + 1 : nextNum).padStart(4, '0')
      this.newCopyForm.notes = ''
    } catch (err) {
      console.error('Error inserting copy:', err)
      alert(`❌ ไม่สามารถบันทึกเล่มย่อยได้: ${err.message}`)
    }
  },

  async updateCopyCondition(copy) {
    try {
      await updateBookCopyCondition(copy.id, copy.condition)
      await this.loadDatabaseData()
      this.selectedBookForCopies = this.booksList.find(book => book.id === this.selectedBookForCopies.id)
    } catch (err) {
      console.error('Error updating copy condition:', err)
      alert(`❌ ไม่สามารถบันทึกสภาพหนังสือได้: ${err.message}`)
      await this.loadDatabaseData()
    }
  },

  async deleteCopy(copyId) {
    if (confirm('ยืนยันลบเล่มหนังสือย่อยนี้?')) {
      try {
        await deleteBookCopy(copyId)
        const currentBookId = this.selectedBookForCopies.id
        
        await this.loadDatabaseData()
        
        // Refresh reference
        this.selectedBookForCopies = this.booksList.find(b => b.id === currentBookId)
      } catch (err) {
        console.error('Error deleting copy:', err)
        alert(`❌ ไม่สามารถลบเล่มย่อยได้: ${err.message}`)
      }
    }
  },

  // Restock Actions (Add Copies by ISBN/Code)
  openRestockModal() {
    this.restockSearchQuery = ''
    this.foundRestockBook = null
    this.restockQuantity = 1
    this.restockCondition = 'ดีมาก'
    this.restockErrorMsg = ''
    this.showRestockModal = true
  },

  searchBookForRestock() {
    const q = this.restockSearchQuery.trim().toLowerCase()
    if (!q) {
      this.foundRestockBook = null
      this.restockErrorMsg = 'กรุณาระบุรหัสหนังสือหลัก หรือ ISBN'
      return
    }

    // ISBN is stored in normalized form, but also supports legacy formatting.
    const cleanQ = normalizeIsbn(this.restockSearchQuery)

    const match = this.booksList.find(b => {
      const codeMatch = b.book_code.toLowerCase().trim() === q
      const isbnMatch = b.isbn ? normalizeIsbn(b.isbn) === cleanQ : false
      return codeMatch || isbnMatch
    })

    if (match) {
      this.foundRestockBook = match
      this.restockErrorMsg = ''
    } else {
      this.foundRestockBook = null
      this.restockErrorMsg = '❌ ไม่พบข้อมูลหนังสือในคลังระบบ กรุณาตรวจสอบรหัสหรือ ISBN อีกครั้ง หรือเลือก "เพิ่มตำราเรียนใหม่"'
    }
  },

  async confirmRestock() {
    if (!this.foundRestockBook) return

    const qty = parseInt(this.restockQuantity)
    if (isNaN(qty) || qty < 1) {
      alert('กรุณาระบุจำนวนเล่มที่ถูกต้อง (อย่างน้อย 1 เล่ม)')
      return
    }

    try {
      const bookId = this.foundRestockBook.id
      const existingCopies = this.getCopiesForBook(bookId)
      
      // Determine starting code number
      let startNum = 1
      if (existingCopies.length > 0) {
        const nums = existingCopies.map(c => parseInt(c.copy_code)).filter(n => !isNaN(n))
        if (nums.length > 0) {
          startNum = Math.max(...nums) + 1
        } else {
          startNum = existingCopies.length + 1
        }
      }

      // Insert new copies
      for (let i = startNum; i < startNum + qty; i++) {
        const copyCode = String(i).padStart(4, '0')
        await createBookCopy({
          book_id: bookId,
          copy_code: copyCode,
          status: 'available',
          condition: this.restockCondition,
          notes: 'เพิ่มสต็อกตำราเรียน (ระบบ ISBN Restock)'
        })
      }

      // Reload
      await this.loadDatabaseData()
      this.showRestockModal = false
      alert(`🎉 เพิ่มสต็อกหนังสือ "${this.foundRestockBook.title}" จำนวน ${qty} เล่มสำเร็จ!`)
    } catch (err) {
      console.error('Error restocking book:', err)
      alert(`❌ ไม่สามารถเพิ่มสต็อกได้: ${err.message}`)
    }
  },

  // ===== BARCODE MODAL METHODS =====
  openBarcodeModal() {
    this.barcodeSelectedBookId = ''
    this.barcodeAvailableCopies = []
    this.barcodeSelectedCopyIds = []
    this.barcodeBookSearch = ''
    this.barcodePaperSize = 'a4'
    this.showBarcodeModal = true
    this.$nextTick(() => {
      const container = document.getElementById('barcode-preview-container')
      if (container) container.querySelectorAll('.barcode-label-item').forEach(el => el.remove())
    })
  },

  requestLandscape() {
    if (screen.orientation?.lock) {
      screen.orientation.lock('landscape').catch(() => {
        // Some mobile browsers only allow orientation locking in fullscreen.
      })
    }
  },

  getFilteredBarcodeBooks() {
    const q = (this.barcodeBookSearch || '').toLowerCase().trim()
    if (!q) return this.booksList
    return this.booksList.filter(b =>
      b.title.toLowerCase().includes(q) ||
      b.book_code.toLowerCase().includes(q) ||
      (b.author && b.author.toLowerCase().includes(q))
    )
  },

  selectBarcodeBook(book) {
    this.barcodeSelectedBookId = book.id
    this.onBarcodeBookChange()
  },

  applyPaperPreset(size) {
    this.barcodePaperSize = size
    this.$nextTick(() => this.renderBarcodePreview())
  },

  getPreviewPaperWidth() {
    // Scale A4/A5/Letter width to screen px for preview (at ~2px per mm)
    // Paper dimensions in mm
    const paperMm = { a4: [210,297], a5: [148,210], letter: [216,279] }
    const SCALE = 1.8 // px per mm for preview
    const dims = paperMm[this.barcodePaperSize] || paperMm.a4
    return Math.round(dims[0] * SCALE)
  },

  getPreviewPaperDims() {
    const paperMm = { a4: [210,297], a5: [148,210], letter: [216,279] }
    const SCALE = 1.8
    let dims
    if (this.barcodePaperSize === 'custom') {
      dims = [this.barcodeCustomPaperW || 210, this.barcodeCustomPaperH || 297]
    } else {
      dims = paperMm[this.barcodePaperSize] || paperMm.a4
    }
    return { w: Math.round(dims[0]*SCALE), h: Math.round(dims[1]*SCALE), mmW: dims[0], mmH: dims[1] }
  },

  onBarcodeBookChange() {
    const book = this.booksList.find(b => b.id === this.barcodeSelectedBookId)
    this.barcodeAvailableCopies = book ? (book.book_copies || []) : []
    this.barcodeSelectedCopyIds = []
    const wrap = document.getElementById('barcode-preview-pages')
    if (wrap) wrap.innerHTML = ''
  },

  selectAllBarcodeCopies() {
    this.barcodeSelectedCopyIds = this.barcodeAvailableCopies.map(c => c.id)
    this.$nextTick(() => this.renderBarcodePreview())
  },

  clearBarcodeCopies() {
    this.barcodeSelectedCopyIds = []
    const wrap = document.getElementById('barcode-preview-pages')
    if (wrap) wrap.innerHTML = ''
  },

  applyBarcodeSizePreset(size) {
    const presets = {
      small:  { w: 35, h: 20, bar: 28, font: 9 },
      medium: { w: 50, h: 30, bar: 40, font: 11 },
      large:  { w: 70, h: 40, bar: 55, font: 13 }
    }
    const p = presets[size]
    if (!p) return
    this.barcodeLabelWidth  = p.w
    this.barcodeLabelHeight = p.h
    this.barcodeBarHeight   = p.bar
    this.barcodeFontSize    = p.font
    this.$nextTick(() => this.renderBarcodePreview())
  },

  renderBarcodePreview() {
    const wrap = document.getElementById('barcode-preview-pages')
    if (!wrap) return
    wrap.innerHTML = ''

    if (this.barcodeSelectedCopyIds.length === 0) return

    const book = this.booksList.find(b => b.id === this.barcodeSelectedBookId)
    const selectedCopies = this.barcodeAvailableCopies.filter(c => this.barcodeSelectedCopyIds.includes(c.id))

    // ── Paper & label dimensions (scale: 1.8 px/mm for preview) ──
    const SCALE = 1.8
    const MARGIN_MM = 8      // paper margin mm
    const GAP_MM    = 3      // label gap mm
    const paperMm = { a4: [210,297], a5: [148,210], letter: [216,279] }
    let pWmm, pHmm
    if (this.barcodePaperSize === 'custom') {
      pWmm = this.barcodeCustomPaperW || 210
      pHmm = this.barcodeCustomPaperH || 297
    } else {
      ;[pWmm, pHmm] = paperMm[this.barcodePaperSize] || paperMm.a4
    }
    const pWpx  = Math.round(pWmm  * SCALE)
    const pHpx  = Math.round(pHmm  * SCALE)
    const margPx = Math.round(MARGIN_MM * SCALE)
    const gapPx  = Math.round(GAP_MM   * SCALE)
    const labW   = Math.round(this.barcodeLabelWidth  * SCALE)
    const labH   = Math.round(this.barcodeLabelHeight * SCALE)

    // Available area inside margins
    const areaW = pWpx - margPx * 2
    const areaH = pHpx - margPx * 2

    // Labels per row / column
    const perRow = Math.max(1, Math.floor((areaW + gapPx) / (labW + gapPx)))
    const perCol = Math.max(1, Math.floor((areaH + gapPx) / (labH + gapPx)))
    const perPage = perRow * perCol

    // ── Chunk copies into pages ──
    const pages = []
    for (let i = 0; i < selectedCopies.length; i += perPage) {
      pages.push(selectedCopies.slice(i, i + perPage))
    }

    pages.forEach((pageCopies, pageIdx) => {
      // Page wrapper (simulated sheet)
      const pageEl = document.createElement('div')
      pageEl.style.cssText = [
        `width:${pWpx}px`,
        `min-height:${pHpx}px`,
        `background:#fff`,
        `box-shadow:0 2px 12px rgba(0,0,0,0.15)`,
        `border-radius:4px`,
        `padding:${margPx}px`,
        `box-sizing:border-box`,
        `display:flex`,
        `flex-wrap:wrap`,
        `justify-content:center`,
        `align-content:flex-start`,
        `gap:${gapPx}px`,
        `flex-shrink:0`,
        `position:relative`
      ].join(';')

      // Page number badge
      const pageNum = document.createElement('div')
      pageNum.style.cssText = `position:absolute;top:4px;right:6px;font-size:${Math.round(SCALE*3.5)}px;color:#bbb;font-family:sans-serif;`
      pageNum.textContent = `หน้า ${pageIdx + 1} / ${pages.length}`
      pageEl.appendChild(pageNum)

      pageCopies.forEach(copy => {
        const barcodeValue = (book ? book.book_code + '-' : '') + copy.copy_code

        const wrapper = document.createElement('div')
        wrapper.className = 'barcode-label-item'
        wrapper.style.width  = labW + 'px'
        wrapper.style.height = labH + 'px'
        wrapper.style.flexShrink = '0'

        if (this.barcodeShowTitle && book) {
          const titleEl = document.createElement('div')
          titleEl.className = 'barcode-label-title'
          titleEl.style.maxWidth = (labW - 6) + 'px'
          titleEl.style.fontSize = Math.max(7, Math.round(SCALE * 3)) + 'px'
          titleEl.textContent = book.title
          wrapper.appendChild(titleEl)
        }

        const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        wrapper.appendChild(svgEl)

        const codeEl = document.createElement('div')
        codeEl.className = 'barcode-label-code'
        codeEl.style.fontSize = Math.max(6, Math.round(SCALE * 2.8)) + 'px'
        codeEl.textContent = barcodeValue
        wrapper.appendChild(codeEl)

        pageEl.appendChild(wrapper)

        try {
          JsBarcode(svgEl, barcodeValue, {
            format: 'CODE128',
            width: Math.max(0.8, SCALE * 0.65),
            height: Math.round(this.barcodeBarHeight * SCALE * 0.45),
            fontSize: this.barcodeFontSize,
            displayValue: false,
            margin: 0,
            background: '#ffffff',
            lineColor: '#000000'
          })
          svgEl.style.maxWidth = (labW - 6) + 'px'
          svgEl.style.height = 'auto'
        } catch (e) {
          console.warn('JsBarcode preview error:', barcodeValue, e)
          svgEl.remove()
          const errEl = document.createElement('div')
          errEl.style.cssText = 'font-size:0.55rem;color:#c94a4a;text-align:center;'
          errEl.textContent = '⚠'
          wrapper.insertBefore(errEl, codeEl)
        }
      })

      wrap.appendChild(pageEl)
    })

    // After rendering — update paper container width to match paper
    const paperContainer = document.getElementById('barcode-preview-paper-container')
    if (paperContainer) paperContainer.style.width = pWpx + 'px'
  },

  printBarcodes() {
    if (this.barcodeSelectedCopyIds.length === 0) return

    const book = this.booksList.find(b => b.id === this.barcodeSelectedBookId)
    const selectedCopies = this.barcodeAvailableCopies.filter(c => this.barcodeSelectedCopyIds.includes(c.id))

    const printArea = document.getElementById('barcode-print-area')
    if (!printArea) return

    // Inject @page rule for paper size
    let paperSize
    if (this.barcodePaperSize === 'custom') {
      paperSize = `${this.barcodeCustomPaperW || 210}mm ${this.barcodeCustomPaperH || 297}mm`
    } else {
      const paperSizes = { a4: 'A4', a5: 'A5', letter: 'letter' }
      paperSize = paperSizes[this.barcodePaperSize] || 'A4'
    }
    let printStyle = document.getElementById('barcode-print-style')
    if (!printStyle) {
      printStyle = document.createElement('style')
      printStyle.id = 'barcode-print-style'
      document.head.appendChild(printStyle)
    }
    printStyle.textContent = `@page { size: ${paperSize}; margin: 8mm; }`
    document.documentElement.style.setProperty('--print-gap', '4mm')

    // Build print HTML
    printArea.innerHTML = ''
    printArea.style.display = 'flex'
    printArea.style.flexWrap = 'wrap'
    printArea.style.justifyContent = 'center'
    printArea.style.gap = '4mm'
    printArea.style.padding = '8mm'
    printArea.style.alignContent = 'flex-start'

    selectedCopies.forEach(copy => {
      const barcodeValue = (book ? book.book_code + '-' : '') + copy.copy_code

      const wrapper = document.createElement('div')
      wrapper.className = 'barcode-label-item'
      wrapper.style.width  = this.barcodeLabelWidth  + 'mm'
      wrapper.style.height = this.barcodeLabelHeight + 'mm'
      wrapper.style.overflow = 'hidden'
      wrapper.style.display = 'flex'
      wrapper.style.flexDirection = 'column'
      wrapper.style.alignItems = 'center'
      wrapper.style.justifyContent = 'center'
      wrapper.style.padding = '1.5mm'
      wrapper.style.boxSizing = 'border-box'
      wrapper.style.gap = '0.5mm'

      if (this.barcodeShowTitle && book) {
        const titleEl = document.createElement('div')
        titleEl.className = 'barcode-label-title'
        titleEl.style.fontSize = '5pt'
        titleEl.style.maxWidth = '100%'
        titleEl.style.overflow = 'hidden'
        titleEl.style.textOverflow = 'ellipsis'
        titleEl.style.whiteSpace = 'nowrap'
        titleEl.style.color = '#000'
        titleEl.textContent = book.title
        wrapper.appendChild(titleEl)
      }

      const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svgEl.style.width = '100%'
      svgEl.style.height = 'auto'
      svgEl.style.display = 'block'
      wrapper.appendChild(svgEl)

      const codeEl = document.createElement('div')
      codeEl.className = 'barcode-label-code'
      codeEl.style.fontSize = '5.5pt'
      codeEl.style.color = '#000'
      codeEl.style.fontFamily = 'monospace'
      codeEl.textContent = barcodeValue
      wrapper.appendChild(codeEl)

      printArea.appendChild(wrapper)

      try {
        JsBarcode(svgEl, barcodeValue, {
          format: 'CODE128',
          width: 1.5,
          height: this.barcodeBarHeight,
          fontSize: this.barcodeFontSize,
          displayValue: false,
          margin: 0,
          background: '#ffffff',
          lineColor: '#000000'
        })
      } catch (e) {
        console.warn('JsBarcode print error:', e)
      }
    })

    // Small delay to ensure SVGs are rendered before printing
    setTimeout(() => {
      window.print()
      // Clean up after printing
      setTimeout(() => {
        printArea.innerHTML = ''
        printArea.style.display = 'none'
      }, 1000)
    }, 200)
  },

  async init() {
    // 1. Inject the sidebar html into its container
    const sidebarContainer = document.getElementById('sidebar-container')
    if (sidebarContainer) {
      sidebarContainer.innerHTML = sidebarHtml
    }

    // 2. Check user session and roles
    const cachedUser = localStorage.getItem('bcp_current_user')
    if (cachedUser) {
      try {
        this.currentUser = JSON.parse(cachedUser)
        // Strict role validation: Only 'admin'
        if (this.currentUser.user_type !== 'admin') {
          alert('❌ เฉพาะผู้ดูแลระบบหรือเจ้าหน้าที่เท่านั้นที่เข้าสู่หน้านี้ได้')
          window.location.href = '../signin.html'
        }
      } catch (e) {
        console.error('Session parse failed:', e)
        window.location.href = '../signin.html'
      }
    } else {
      window.location.href = '../signin.html'
    }

    // 3. Load live database entries
    await this.loadDatabaseData()

    // 4. Load banner/slider data from localStorage
    this.loadBanners()
  },

  logout() {
    if (confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
      localStorage.removeItem('bcp_current_user')
      window.location.href = '../signin.html'
    }
  }
}))

window.Alpine = Alpine
Alpine.start()
