declare module 'react-thailand-address-typeahead' {
  import * as React from 'react';

  export interface ThailandAddressValue {
    subdistrict?: string;
    district?: string;
    province?: string;
    postalCode?: string | number;
    [key: string]: any;
  }

  export interface AddressTypeaheadProps {
    onSelect?: (address: ThailandAddressValue | any) => void;
    value?: ThailandAddressValue | any;
    onValueChange?: (nextVal: ThailandAddressValue) => void;
    children?: React.ReactNode;
    datasource?: any[];
    [key: string]: any;
  }

  export const AddressTypeahead: React.FC<AddressTypeaheadProps>;

  export const ThailandAddressTypeahead: React.FC<AddressTypeaheadProps> & {
    SubdistrictInput: React.FC<any>;
    DistrictInput: React.FC<any>;
    ProvinceInput: React.FC<any>;
    PostalCodeInput: React.FC<any>;
    Suggestion: React.FC<any>;
    CustomSuggestion: React.FC<any>;
  };

  export const SubdistrictInput: React.FC<any>;
  export const DistrictInput: React.FC<any>;
  export const ProvinceInput: React.FC<any>;
  export const PostalCodeInput: React.FC<any>;
  export const Suggestion: React.FC<any>;
  export const CustomSuggestion: React.FC<any>;
}
