/*
 * A small offline city table, so a chart can be cast without a geocoding service. Coordinates
 * are city centres to about 0.01° (≈1 km; under a minute of arc on the Ascendant in most cases,
 * but give exact coordinates for a precise chart). The first block is reused from the COSINE
 * birth form; the second adds some large world cities.
 */

/** [English name, Chinese name, latitude, longitude, IANA time zone] */
export type CityRow = [string, string, number, number, string];

export const CITIES: CityRow[] = [
  ["Beijing", "北京", 39.9042, 116.4074, "Asia/Shanghai"],
  ["Shanghai", "上海", 31.2304, 121.4737, "Asia/Shanghai"],
  ["Guangzhou", "广州", 23.1291, 113.2644, "Asia/Shanghai"],
  ["Shenzhen", "深圳", 22.5431, 114.0579, "Asia/Shanghai"],
  ["Tianjin", "天津", 39.0842, 117.201, "Asia/Shanghai"],
  ["Chongqing", "重庆", 29.563, 106.5516, "Asia/Shanghai"],
  ["Chengdu", "成都", 30.5728, 104.0668, "Asia/Shanghai"],
  ["Hangzhou", "杭州", 30.2741, 120.1551, "Asia/Shanghai"],
  ["Nanjing", "南京", 32.0603, 118.7969, "Asia/Shanghai"],
  ["Wuhan", "武汉", 30.5928, 114.3055, "Asia/Shanghai"],
  ["Xi'an", "西安", 34.3416, 108.9398, "Asia/Shanghai"],
  ["Suzhou", "苏州", 31.2989, 120.5853, "Asia/Shanghai"],
  ["Zhengzhou", "郑州", 34.7466, 113.6253, "Asia/Shanghai"],
  ["Changsha", "长沙", 28.2282, 112.9388, "Asia/Shanghai"],
  ["Shenyang", "沈阳", 41.8057, 123.4315, "Asia/Shanghai"],
  ["Qingdao", "青岛", 36.0671, 120.3826, "Asia/Shanghai"],
  ["Jinan", "济南", 36.6512, 117.1201, "Asia/Shanghai"],
  ["Dalian", "大连", 38.914, 121.6147, "Asia/Shanghai"],
  ["Harbin", "哈尔滨", 45.8038, 126.535, "Asia/Shanghai"],
  ["Changchun", "长春", 43.8171, 125.3235, "Asia/Shanghai"],
  ["Fuzhou", "福州", 26.0745, 119.2965, "Asia/Shanghai"],
  ["Xiamen", "厦门", 24.4798, 118.0894, "Asia/Shanghai"],
  ["Kunming", "昆明", 25.0389, 102.7183, "Asia/Shanghai"],
  ["Guiyang", "贵阳", 26.647, 106.6302, "Asia/Shanghai"],
  ["Nanning", "南宁", 22.817, 108.3665, "Asia/Shanghai"],
  ["Nanchang", "南昌", 28.682, 115.8579, "Asia/Shanghai"],
  ["Hefei", "合肥", 31.8206, 117.2272, "Asia/Shanghai"],
  ["Taiyuan", "太原", 37.8706, 112.5489, "Asia/Shanghai"],
  ["Shijiazhuang", "石家庄", 38.0428, 114.5149, "Asia/Shanghai"],
  ["Lanzhou", "兰州", 36.0611, 103.8343, "Asia/Shanghai"],
  ["Yinchuan", "银川", 38.4872, 106.2309, "Asia/Shanghai"],
  ["Xining", "西宁", 36.6171, 101.7782, "Asia/Shanghai"],
  ["Hohhot", "呼和浩特", 40.8414, 111.7519, "Asia/Shanghai"],
  ["Urumqi", "乌鲁木齐", 43.8256, 87.6168, "Asia/Shanghai"],
  ["Lhasa", "拉萨", 29.65, 91.1, "Asia/Shanghai"],
  ["Haikou", "海口", 20.044, 110.1999, "Asia/Shanghai"],
  ["Sanya", "三亚", 18.2528, 109.5119, "Asia/Shanghai"],
  ["Ningbo", "宁波", 29.8683, 121.544, "Asia/Shanghai"],
  ["Wuxi", "无锡", 31.4912, 120.3119, "Asia/Shanghai"],
  ["Wenzhou", "温州", 27.9938, 120.6994, "Asia/Shanghai"],
  ["Dongguan", "东莞", 23.0207, 113.7518, "Asia/Shanghai"],
  ["Foshan", "佛山", 23.0215, 113.1214, "Asia/Shanghai"],
  ["Zhuhai", "珠海", 22.271, 113.5767, "Asia/Shanghai"],
  ["Yantai", "烟台", 37.4638, 121.4479, "Asia/Shanghai"],
  ["Luoyang", "洛阳", 34.6197, 112.454, "Asia/Shanghai"],
  ["Hong Kong", "香港", 22.3193, 114.1694, "Asia/Hong_Kong"],
  ["Macau", "澳门", 22.1987, 113.5439, "Asia/Macau"],
  ["Taipei", "台北", 25.033, 121.5654, "Asia/Taipei"],
  ["Kaohsiung", "高雄", 22.6273, 120.3014, "Asia/Taipei"],
  ["Taichung", "台中", 24.1477, 120.6736, "Asia/Taipei"],
  ["Tainan", "台南", 22.9999, 120.2269, "Asia/Taipei"],
  ["New Taipei", "新北", 25.012, 121.4657, "Asia/Taipei"],
  ["Taoyuan", "桃园", 24.9936, 121.301, "Asia/Taipei"],
  ["Hsinchu", "新竹", 24.8138, 120.9675, "Asia/Taipei"],
  ["Keelung", "基隆", 25.1276, 121.7392, "Asia/Taipei"],
  ["Chiayi", "嘉义", 23.4801, 120.4491, "Asia/Taipei"],
  ["Changhua", "彰化", 24.0809, 120.5385, "Asia/Taipei"],
  ["Miaoli", "苗栗", 24.5602, 120.8214, "Asia/Taipei"],
  ["Nantou", "南投", 23.9097, 120.6839, "Asia/Taipei"],
  ["Yunlin", "云林", 23.7092, 120.4313, "Asia/Taipei"],
  ["Pingtung", "屏东", 22.6762, 120.4929, "Asia/Taipei"],
  ["Yilan", "宜兰", 24.7021, 121.7378, "Asia/Taipei"],
  ["Hualien", "花莲", 23.9871, 121.6015, "Asia/Taipei"],
  ["Taitung", "台东", 22.7583, 121.1444, "Asia/Taipei"],
  ["Penghu", "澎湖", 23.5711, 119.5793, "Asia/Taipei"],
  ["Kinmen", "金门", 24.4493, 118.3767, "Asia/Taipei"],
  ["Tokyo", "东京", 35.6762, 139.6503, "Asia/Tokyo"],
  ["Osaka", "大阪", 34.6937, 135.5023, "Asia/Tokyo"],
  ["Seoul", "首尔", 37.5665, 126.978, "Asia/Seoul"],
  ["Singapore", "新加坡", 1.3521, 103.8198, "Asia/Singapore"],
  ["Kuala Lumpur", "吉隆坡", 3.139, 101.6869, "Asia/Kuala_Lumpur"],
  ["Bangkok", "曼谷", 13.7563, 100.5018, "Asia/Bangkok"],
  ["London", "伦敦", 51.5074, -0.1278, "Europe/London"],
  ["Paris", "巴黎", 48.8566, 2.3522, "Europe/Paris"],
  ["Berlin", "柏林", 52.52, 13.405, "Europe/Berlin"],
  ["Moscow", "莫斯科", 55.7558, 37.6173, "Europe/Moscow"],
  ["New York", "纽约", 40.7128, -74.006, "America/New_York"],
  ["Los Angeles", "洛杉矶", 34.0522, -118.2437, "America/Los_Angeles"],
  ["San Francisco", "旧金山", 37.7749, -122.4194, "America/Los_Angeles"],
  ["Chicago", "芝加哥", 41.8781, -87.6298, "America/Chicago"],
  ["Toronto", "多伦多", 43.6532, -79.3832, "America/Toronto"],
  ["Vancouver", "温哥华", 49.2827, -123.1207, "America/Vancouver"],
  ["Sydney", "悉尼", -33.8688, 151.2093, "Australia/Sydney"],
  ["Melbourne", "墨尔本", -37.8136, 144.9631, "Australia/Melbourne"],
  ["Auckland", "奥克兰", -36.8485, 174.7633, "Pacific/Auckland"],
  ["Delhi", "德里", 28.6139, 77.209, "Asia/Kolkata"],
  ["Mumbai", "孟买", 19.076, 72.8777, "Asia/Kolkata"],
  ["Dubai", "迪拜", 25.2048, 55.2708, "Asia/Dubai"],
  ["Istanbul", "伊斯坦布尔", 41.0082, 28.9784, "Europe/Istanbul"],
  ["Cairo", "开罗", 30.0444, 31.2357, "Africa/Cairo"],
  ["Lagos", "拉各斯", 6.5244, 3.3792, "Africa/Lagos"],
  ["Johannesburg", "约翰内斯堡", -26.2041, 28.0473, "Africa/Johannesburg"],
  ["Jakarta", "雅加达", -6.2088, 106.8456, "Asia/Jakarta"],
  ["Manila", "马尼拉", 14.5995, 120.9842, "Asia/Manila"],
  ["Hanoi", "河内", 21.0278, 105.8342, "Asia/Ho_Chi_Minh"],
  ["Ho Chi Minh City", "胡志明市", 10.8231, 106.6297, "Asia/Ho_Chi_Minh"],
  ["Madrid", "马德里", 40.4168, -3.7038, "Europe/Madrid"],
  ["Rome", "罗马", 41.9028, 12.4964, "Europe/Rome"],
  ["Amsterdam", "阿姆斯特丹", 52.3676, 4.9041, "Europe/Amsterdam"],
  ["Dublin", "都柏林", 53.3498, -6.2603, "Europe/Dublin"],
  ["Zurich", "苏黎世", 47.3769, 8.5417, "Europe/Zurich"],
  ["Stockholm", "斯德哥尔摩", 59.3293, 18.0686, "Europe/Stockholm"],
  ["Washington", "华盛顿", 38.9072, -77.0369, "America/New_York"],
  ["Boston", "波士顿", 42.3601, -71.0589, "America/New_York"],
  ["Miami", "迈阿密", 25.7617, -80.1918, "America/New_York"],
  ["Houston", "休斯敦", 29.7604, -95.3698, "America/Chicago"],
  ["Denver", "丹佛", 39.7392, -104.9903, "America/Denver"],
  ["Seattle", "西雅图", 47.6062, -122.3321, "America/Los_Angeles"],
  ["Mexico City", "墨西哥城", 19.4326, -99.1332, "America/Mexico_City"],
  ["São Paulo", "圣保罗", -23.5505, -46.6333, "America/Sao_Paulo"],
  ["Buenos Aires", "布宜诺斯艾利斯", -34.6037, -58.3816, "America/Argentina/Buenos_Aires"],
];

export interface City {
  name: string;
  name_zh: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

/* Traditional → Simplified for the characters in the Chinese names above */
const T2S: Record<string, string> = Object.fromEntries(
  [..."臺門東華爾倫約蘭莊慶寧陽漢廣島蘇無錫溫連雲蘭貴魯齊薩區澳畫義彰屏蓮灣爾馬達亞納圖斯堡羅蒙紐盧機哥舊溫爾倫亞維羅聖諾斯斯德烏長濟瀋鄭廈銀煙磯奧濱園"].map(
    (c, i) => [c, "台门东华尔伦约兰庄庆宁阳汉广岛苏无锡温连云兰贵鲁齐萨区澳画义彰屏莲湾尔马达亚纳图斯堡罗蒙纽卢机哥旧温尔伦亚维罗圣诺斯斯德乌长济沈郑厦银烟矶奥滨园"[i]],
  ),
);

const key = (s: string) =>
  [...s]
    .map((c) => T2S[c] ?? c)
    .join("")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s'’.,-]/g, "")
    .replace(/[市县]$/, "");

const INDEX = new Map<string, CityRow>();
for (const row of CITIES) {
  INDEX.set(key(row[0]), row);
  INDEX.set(key(row[1]), row);
}
// a few common alternative spellings
const ALIASES: Record<string, string> = {
  nyc: "New York",
  newyorkcity: "New York",
  la: "Los Angeles",
  sf: "San Francisco",
  hk: "Hong Kong",
  saopaulo: "São Paulo",
  bombay: "Mumbai",
  newdelhi: "Delhi",
  saigon: "Ho Chi Minh City",
  peking: "Beijing",
  canton: "Guangzhou",
  washingtondc: "Washington",
};
for (const [alias, name] of Object.entries(ALIASES)) {
  const row = INDEX.get(key(name));
  if (row) INDEX.set(key(alias), row);
}

const toCity = (r: CityRow): City => ({
  name: r[0],
  name_zh: r[1],
  latitude: r[2],
  longitude: r[3],
  timezone: r[4],
});

/** Exact (case-, accent- and space-insensitive) match on an English or Chinese city name. */
export function findCity(name: string): City | null {
  const q = name.split(",")[0];
  const row = INDEX.get(key(q));
  return row ? toCity(row) : null;
}

export const cityNames = (): string[] => CITIES.map((r) => r[0]);
