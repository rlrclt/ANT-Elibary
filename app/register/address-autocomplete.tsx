"use client";

import React from "react";
import { ThailandAddressTypeahead } from "react-thailand-address-typeahead";
import type { ThailandAddressValue } from "react-thailand-address-typeahead";

interface AddressAutocompleteProps {
  value: ThailandAddressValue;
  onValueChange: (val: ThailandAddressValue) => void;
}

export default function AddressAutocomplete({
  value,
  onValueChange,
}: AddressAutocompleteProps) {
  return (
    <ThailandAddressTypeahead value={value} onValueChange={onValueChange}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            ตำบล/แขวง <span className="text-terracotta">*</span>
          </label>
          <ThailandAddressTypeahead.SubdistrictInput
            name="subdistrict"
            placeholder="ค้นหาตำบล"
            className="w-full pl-3 pr-3 py-2.5 text-sm bg-white border border-gray-200 rounded-md outline-none transition focus:border-meb-green focus:ring-2 focus:ring-meb-light placeholder:text-slate-400"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            อำเภอ/เขต <span className="text-terracotta">*</span>
          </label>
          <ThailandAddressTypeahead.DistrictInput
            name="district"
            placeholder="ค้นหาอำเภอ"
            className="w-full pl-3 pr-3 py-2.5 text-sm bg-white border border-gray-200 rounded-md outline-none transition focus:border-meb-green focus:ring-2 focus:ring-meb-light placeholder:text-slate-400"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            จังหวัด <span className="text-terracotta">*</span>
          </label>
          <ThailandAddressTypeahead.ProvinceInput
            name="province"
            placeholder="ค้นหาจังหวัด"
            className="w-full pl-3 pr-3 py-2.5 text-sm bg-white border border-gray-200 rounded-md outline-none transition focus:border-meb-green focus:ring-2 focus:ring-meb-light placeholder:text-slate-400"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            รหัสไปรษณีย์ <span className="text-terracotta">*</span>
          </label>
          <ThailandAddressTypeahead.PostalCodeInput
            name="postal_code"
            placeholder="รหัสไปรษณีย์"
            className="w-full pl-3 pr-3 py-2.5 text-sm bg-white border border-gray-200 rounded-md outline-none transition focus:border-meb-green focus:ring-2 focus:ring-meb-light placeholder:text-slate-400"
            required
          />
        </div>
      </div>

      <div className="relative">
        <ThailandAddressTypeahead.Suggestion
          containerProps={{
            className:
              "absolute z-50 left-0 right-0 max-h-60 overflow-y-auto bg-white border border-gray-200 shadow-lg rounded-md mt-1 divide-y divide-gray-100 p-0 list-none",
            style: { listStyleType: "none" },
          }}
          optionItemProps={{
            className:
              "px-4 py-2 text-sm hover:bg-slate-50 cursor-pointer text-slate-700 transition",
          }}
        />
      </div>
    </ThailandAddressTypeahead>
  );
}
