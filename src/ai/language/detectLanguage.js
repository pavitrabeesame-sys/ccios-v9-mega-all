const BM_KEYWORDS = [
  "barang",
  "kualiti",
  "berbaloi",
  "cantik",
  "cepat",
  "lambat",
  "murah",
  "baik",
  "terbaik",
  "terima",
  "kasih",
  "seller",
  "packing",
  "bungkus",
  "penghantaran",
  "servis",
  "memuaskan",
  "recommended",
  "disyorkan",
  "sampai",
  "baloi",
  "warna",
  "saiz"
];

export function detectLanguage(text = "") {

  if (!text) {
    return "EN";
  }

  const value = text.trim().toLowerCase();

  // Chinese
  if (/[\u4e00-\u9fff]/.test(value)) {
    return "ZH";
  }

  // Bahasa Malaysia
  for (const word of BM_KEYWORDS) {
    if (value.includes(word)) {
      return "BM";
    }
  }

  // Default
  return "EN";
}

export default detectLanguage;