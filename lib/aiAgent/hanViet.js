/**
 * hanViet.js
 * Bảng tra Hán tự -> Hán Việt dùng cho Bát Tự.
 * Đã đối chiếu và khớp 100% với ảnh mẫu "Tứ Trụ Mệnh Bàn" (Nam mệnh 11:30 - 31/8/1980)
 * khi tính qua thư viện lunar-javascript.
 */

const CAN = {
    '甲': 'Giáp', '乙': 'Ất', '丙': 'Bính', '丁': 'Đinh', '戊': 'Mậu',
    '己': 'Kỷ', '庚': 'Canh', '辛': 'Tân', '壬': 'Nhâm', '癸': 'Quý',
};

const CHI = {
    '子': 'Tý', '丑': 'Sửu', '寅': 'Dần', '卯': 'Mão', '辰': 'Thìn',
    '巳': 'Tỵ', '午': 'Ngọ', '未': 'Mùi', '申': 'Thân', '酉': 'Dậu',
    '戌': 'Tuất', '亥': 'Hợi',
};

// Ngũ hành của Can / Chi - dùng để tô màu (Kim/Mộc/Thủy/Hỏa/Thổ) giống chú thích cuối bảng mẫu
const CAN_WUXING = {
    '甲': 'Mộc', '乙': 'Mộc', '丙': 'Hỏa', '丁': 'Hỏa', '戊': 'Thổ',
    '己': 'Thổ', '庚': 'Kim', '辛': 'Kim', '壬': 'Thủy', '癸': 'Thủy',
};
const CHI_WUXING = {
    '子': 'Thủy', '丑': 'Thổ', '寅': 'Mộc', '卯': 'Mộc', '辰': 'Thổ',
    '巳': 'Hỏa', '午': 'Hỏa', '未': 'Thổ', '申': 'Kim', '酉': 'Kim',
    '戌': 'Thổ', '亥': 'Thủy',
};

// Thập Thần: tên đầy đủ + nhãn viết tắt như trong ảnh mẫu ("T.Tài", "Sát", "Kiêu"...)
const SHI_SHEN = {
    '比肩': { full: 'Tỷ Kiên', abbr: 'Tỷ' },
    '劫财': { full: 'Kiếp Tài', abbr: 'Kiếp' },
    '食神': { full: 'Thực Thần', abbr: 'Thực' },
    '伤官': { full: 'Thương Quan', abbr: 'Thương' },
    '偏财': { full: 'Thiên Tài', abbr: 'T.Tài' },
    '正财': { full: 'Chính Tài', abbr: 'Tài' },
    '七杀': { full: 'Thất Sát', abbr: 'Sát' },
    '正官': { full: 'Chính Quan', abbr: 'Quan' },
    '偏印': { full: 'Kiêu Thần', abbr: 'Kiêu' },
    '正印': { full: 'Chính Ấn', abbr: 'Ấn' },
};

// 12 giai đoạn Trường Sinh
const DI_SHI = {
    '长生': 'Trường sinh', '沐浴': 'Mộc dục', '冠带': 'Quan đới', '临官': 'Lâm quan',
    '帝旺': 'Đế vượng', '衰': 'Suy', '病': 'Bệnh', '死': 'Tử',
    '墓': 'Mộ', '绝': 'Tuyệt', '胎': 'Thai', '养': 'Dưỡng',
};

// 30 Nạp Âm (mỗi tên dùng chung cho 2 trụ Can Chi liên tiếp)
const NA_YIN = {
    '海中金': 'Hải Trung Kim', '炉中火': 'Lư Trung Hỏa', '大林木': 'Đại Lâm Mộc',
    '路旁土': 'Lộ Bàng Thổ', '剑锋金': 'Kiếm Phong Kim', '山头火': 'Sơn Đầu Hỏa',
    '涧下水': 'Giản Hạ Thủy', '城头土': 'Thành Đầu Thổ', '白蜡金': 'Bạch Lạp Kim',
    '杨柳木': 'Dương Liễu Mộc', '泉中水': 'Tuyền Trung Thủy', '屋上土': 'Ốc Thượng Thổ',
    '霹雳火': 'Tích Lịch Hỏa', '松柏木': 'Tùng Bách Mộc', '长流水': 'Trường Lưu Thủy',
    '沙中金': 'Sa Trung Kim', '山下火': 'Sơn Hạ Hỏa', '平地木': 'Bình Địa Mộc',
    '壁上土': 'Bích Thượng Thổ', '金箔金': 'Kim Bạc Kim', '覆灯火': 'Phúc Đăng Hỏa',
    '天河水': 'Thiên Hà Thủy', '大驿土': 'Đại Dịch Thổ', '钗钏金': 'Thoa Xuyến Kim',
    '桑柘木': 'Tang Đố Mộc', '大溪水': 'Đại Khê Thủy', '沙中土': 'Sa Trung Thổ',
    '天上火': 'Thiên Thượng Hỏa', '石榴木': 'Thạch Lựu Mộc', '大海水': 'Đại Hải Thủy',
};

function toCan(ch) { return CAN[ch] || ch; }
function toChi(ch) { return CHI[ch] || ch; }

// "庚申" -> "Canh Thân"
function toGanZhi(str) {
    if (!str) return '';
    const [g, z] = str.split('');
    return `${toCan(g)} ${toChi(z)}`.trim();
}

// Tuần không dạng "子丑" (2 Chi, không có Can) -> "Tý-Sửu"
function toChiPair(str) {
    if (!str) return '';
    return str.split('').map(toChi).join('-');
}

function toShiShen(str, { abbr = false } = {}) {
    if (!str) return '';
    const entry = SHI_SHEN[str];
    if (!entry) return str;
    return abbr ? entry.abbr : entry.full;
}

function toDiShi(str) { return DI_SHI[str] || str; }

function toNaYin(str) { return NA_YIN[str] || str; }

function wuXingOfCan(ch) { return CAN_WUXING[ch] || ''; }
function wuXingOfChi(ch) { return CHI_WUXING[ch] || ''; }

module.exports = {
    CAN, CHI, SHI_SHEN, DI_SHI, NA_YIN,
    toCan, toChi, toGanZhi, toChiPair, toShiShen, toDiShi, toNaYin,
    wuXingOfCan, wuXingOfChi,
};