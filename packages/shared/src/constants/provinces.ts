// Danh sách 34 đơn vị hành chính cấp tỉnh của Việt Nam sau đợt sáp nhập
// 01/07/2025 (28 tỉnh + 6 thành phố trực thuộc trung ương), theo Nghị quyết
// 202/2025/QH15 ngày 12/6/2025. Xác nhận lại nguồn chính thức nếu danh sách
// được cập nhật.
export const VIETNAM_PROVINCES = [
  'Hà Nội',
  'Huế',
  'Lai Châu',
  'Điện Biên',
  'Sơn La',
  'Lạng Sơn',
  'Quảng Ninh',
  'Thanh Hóa',
  'Nghệ An',
  'Hà Tĩnh',
  'Cao Bằng',
  'Tuyên Quang',
  'Lào Cai',
  'Thái Nguyên',
  'Phú Thọ',
  'Bắc Ninh',
  'Hưng Yên',
  'Hải Phòng',
  'Ninh Bình',
  'Quảng Trị',
  'Đà Nẵng',
  'Quảng Ngãi',
  'Gia Lai',
  'Khánh Hòa',
  'Lâm Đồng',
  'Đắk Lắk',
  'Thành phố Hồ Chí Minh',
  'Đồng Nai',
  'Tây Ninh',
  'Cần Thơ',
  'Vĩnh Long',
  'Đồng Tháp',
  'Cà Mau',
  'An Giang',
] as const;

export type VietnamProvince = (typeof VIETNAM_PROVINCES)[number];
