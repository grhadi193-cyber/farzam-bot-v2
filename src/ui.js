'use strict';

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function digits(value) {
  return String(value).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}
function mainMenu() {
  return { keyboard: [
    [{ text: '📊 گزارش مالی' }, { text: '🧾 فروش و خرید' }],
    [{ text: '🏦 بانک و نقدینگی' }, { text: '✅ تأییدهای در انتظار' }],
    [{ text: '🤖 راهنمای موس' }, { text: '🔄 وضعیت سیستم' }],
  ], resize_keyboard: true, is_persistent: true, input_field_placeholder: 'سؤال یا درخواستت را بنویس…' };
}
function welcome(name) {
  return `<b>سلام ${escapeHtml(name || 'دوست عزیز')} 👋</b>\n\nبه دستیار هوشمند فرزام خوش اومدی. من پیام تو را به هسته ERP و Muse می‌رسونم و نتیجه را مرتب و قابل‌فهم برمی‌گردونم.\n\nاز دکمه‌ها استفاده کن یا مستقیم بپرس؛ مثلاً: «فروش‌های مرداد ۱۴۰۴ به شرکت X را نشان بده».`;
}
function authPrompt() {
  return '<b>سلام و خوش اومدی 👋</b>\n\nبرای ورود به فضای سازمانی، کد دسترسی اختصاصی‌ات را همین‌جا بفرست. تا قبل از تأیید، هیچ داده‌ای نمایش داده نمی‌شود.';
}
function authSuccess(name) {
  return `<b>ورود با موفقیت انجام شد ✅</b>\n\nخوش اومدی ${escapeHtml(name || 'همکار عزیز')}. دسترسی‌ات ثبت شد و از این لحظه می‌تونی با Muse و ERP کار کنی.`;
}
function processing() { return '<b>درخواستت رسید ⏳</b>\n\nدارم اطلاعات را از ERP بررسی می‌کنم و نتیجه را آماده می‌کنم…'; }
function menuResponse(text) {
  const map = {
    '📊 گزارش مالی': 'برای گزارش مالی، سؤال دقیق یا بازه زمانی را بنویس؛ مثلاً: «وضعیت مالی شهریور ۱۴۰۴ را خلاصه کن».',
    '🧾 فروش و خرید': 'نام شرکت، نوع سند و بازه را بنویس تا Muse فاکتورها را از ERP پیدا کند.',
    '🏦 بانک و نقدینگی': 'می‌توانی بپرسی: «واریزهای مرداد ۱۴۰۴ به حساب شرکت را نشان بده».',
    '✅ تأییدهای در انتظار': 'درخواست‌های نیازمند تأیید از مسیر امن Muse/ERP برایت ارسال می‌شوند.',
    '🤖 راهنمای موس': 'Muse مغز تحلیلی سیستم است؛ من پیام را می‌گیرم، وضعیت را نشان می‌دهم و پاسخ نهایی را برمی‌گردانم.',
    '🔄 وضعیت سیستم': 'بات آماده دریافت پیام است. برای عملیات ERP، نتیجه پس از بررسی و ثبت audit برمی‌گردد.',
  };
  return map[text] || null;
}
module.exports = { escapeHtml, digits, mainMenu, welcome, authPrompt, authSuccess, processing, menuResponse };
