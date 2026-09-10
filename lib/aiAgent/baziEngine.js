/**
 * baziEngine.js
 * Tính toàn bộ bảng Tứ Trụ Bát Tự bằng thuật toán tất định (lunar-javascript).
 * KHÔNG gọi LLM ở đây. Input phải đã được chuẩn hoá (xem birthInfoExtractor.js).
 *
 * npm i lunar-javascript@^1.7.7
 */

const { Solar, Lunar } = require('lunar-javascript');
const hv = require('./hanViet');

// Bảng offset UTC gần đúng theo quốc gia — chỉ dùng để quy đổi giờ sinh từ nước ngoài
// về giờ dương lịch tính lịch (không xử lý DST). Có thể mở rộng thêm.
const COUNTRY_UTC_OFFSET = {
    'việt nam': 7, 'vietnam': 7, 'vn': 7,
    'mỹ': -5, 'usa': -5, 'hoa kỳ': -5, 'us': -5, // mặc định múi Đông Mỹ, không chính xác tuyệt đối
    'trung quốc': 8, 'china': 8,
    'hàn quốc': 9, 'korea': 9,
    'nhật bản': 9, 'japan': 9,
    'úc': 10, 'australia': 10,
    'anh': 0, 'uk': 0, 'england': 0,
    'pháp': 1, 'france': 1,
    'đức': 1, 'germany': 1,
    'canada': -5,
};

const TARGET_OFFSET = 7; // quy chuẩn tính theo giờ Việt Nam (UTC+7), giống cách hocvienlyso.org ghi "GMT+7.0"

/**
 * Quy đổi giờ sinh về UTC+7 nếu biết quốc gia sinh (best-effort, KHÔNG xử lý giờ mùa hè).
 * Nếu không xác định được quốc gia, giữ nguyên giờ đã nhập (coi như đã là giờ địa phương cần dùng).
 */
function normalizeToVnTime({ year, month, day, hour, minute, country }) {
    const key = (country || '').trim().toLowerCase();
    const offset = COUNTRY_UTC_OFFSET[key];
    if (offset === undefined || offset === TARGET_OFFSET) {
        return { year, month, day, hour, minute, adjusted: false };
    }
    const diffHours = TARGET_OFFSET - offset;
    const d = new Date(Date.UTC(year, month - 1, day, hour, minute));
    d.setUTCHours(d.getUTCHours() + diffHours);
    return {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
        hour: d.getUTCHours(),
        minute: d.getUTCMinutes(),
        adjusted: true,
    };
}

/**
 * input: {
 *   gender: 'Nam' | 'Nữ',
 *   calendarType: 'Dương lịch' | 'Âm lịch',
 *   year, month, day, hour, minute,
 *   isLeapMonth?: boolean,   // chỉ áp dụng khi calendarType = 'Âm lịch'
 *   country?: string,
 *   applyTimezoneNormalization?: boolean  // default true
 * }
 */
function calculate(input) {
    const {
        gender, calendarType, isLeapMonth = false, country,
        applyTimezoneNormalization = true,
    } = input;
    let { year, month, day, hour, minute } = input;

    if ([year, month, day, hour, minute].some((v) => v === null || v === undefined || Number.isNaN(v))) {
        throw new Error('Thiếu thông tin ngày/giờ sinh để tính Bát Tự — cần admin nhập bổ sung thủ công.');
    }

    let normInfo = { adjusted: false };
    if (applyTimezoneNormalization && calendarType !== 'Âm lịch') {
        normInfo = normalizeToVnTime({ year, month, day, hour, minute, country });
        ({ year, month, day, hour, minute } = normInfo);
    }

    const lunar = calendarType === 'Âm lịch'
        ? Lunar.fromYmdHms(year, month, day, hour, minute, 0, isLeapMonth ? -1 : 1) // lunar-javascript: month âm < 0 nghĩa là tháng nhuận
        : Solar.fromYmdHms(year, month, day, hour, minute, 0).getLunar();

    const ec = lunar.getEightChar();
    const genderCode = /nữ|nu|female/i.test(gender || '') ? 0 : 1; // 1 = Nam, 0 = Nữ (theo lunar-javascript)

    const pillars = ['Year', 'Month', 'Day', 'Time'];
    const tuTru = pillars.map((p) => hv.toGanZhi(ec[`get${p}`]()));
    const chuTinh = pillars.map((p, idx) => (
        idx === 2 ? 'NHẬT CHỦ' : hv.toShiShen(ec[`get${p}ShiShenGan`](), { abbr: true })
    ));
    const tangCan = pillars.map((p) => ec[`get${p}HideGan`]().map(hv.toCan));
    const phoTinh = pillars.map((p) => ec[`get${p}ShiShenZhi`]().map((s) => hv.toShiShen(s, { abbr: true })));
    const truongSinh = pillars.map((p) => hv.toDiShi(ec[`get${p}DiShi`]()));
    const napAm = pillars.map((p) => hv.toNaYin(ec[`get${p}NaYin`]()));

    // Đại Vận + Lưu Niên
    const yun = ec.getYun(genderCode);
    const rawDaiVan = yun.getDaYun(11); // 11 = 1 giai đoạn "chưa nhập vận" + 10 đại vận thật (khớp ảnh mẫu)
    const daiVan = rawDaiVan
        .filter((dv) => dv.getGanZhi()) // bỏ giai đoạn chưa nhập vận (ganZhi rỗng)
        .map((dv) => ({
            canChi: hv.toGanZhi(dv.getGanZhi()),
            tuoiBatDau: dv.getStartAge(),
            tuoiKetThuc: dv.getEndAge(),
            namBatDau: dv.getStartYear(),
            namKetThuc: dv.getEndYear(),
            luuNien: dv.getLiuNian().map((ln) => ({
                nam: ln.getYear(),
                tuoi: ln.getAge(),
                canChi: hv.toGanZhi(ln.getGanZhi()),
            })),
        }));

    return {
        thongTinNhapLieu: {
            gioiTinh: gender,
            lichNhap: calendarType,
            ngaySinh: { year, month, day, hour, minute },
            quocGia: country || null,
            daQuyDoiGioVN: normInfo.adjusted,
            ghiChu: normInfo.adjusted
                ? 'Đã quy đổi giờ sinh về giờ Việt Nam (UTC+7) theo quốc gia khai báo — chỉ mang tính ước lượng, không xử lý giờ mùa hè.'
                : 'Giữ nguyên giờ sinh như đã nhập.',
        },
        tuTru,               // ["Canh Thân","Giáp Thân","Bính Tý","Giáp Ngọ"]
        chuTinh,              // thập thần của Can từng trụ, cột Ngày = "NHẬT CHỦ"
        tangCan,              // mảng Can ẩn trong Chi từng trụ
        phoTinh,              // thập thần tương ứng với từng Can ẩn
        truongSinh,           // 12 giai đoạn trường sinh từng trụ
        napAm,                // nạp âm từng trụ
        nhatChu: hv.toCan(ec.getDayGan()),
        daiVan,
        mệnhCung: hv.toGanZhi(ec.getMingGong()),
        thaiNguyen: hv.toGanZhi(ec.getTaiYuan()),
        thaiTuc: hv.toGanZhi(ec.getTaiXi()),
        nienKhong: hv.toChiPair(ec.getYearXunKong()),
        nhatKhong: hv.toChiPair(ec.getDayXunKong()),
    };
}

module.exports = { calculate, normalizeToVnTime };