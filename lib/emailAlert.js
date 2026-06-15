import { isEmailNotificationsEnabled } from "@/lib/appConfig";
import { formatJakartaDateTime } from "@/lib/localDate";

const envEnabled=String(process.env.ALERT_EMAIL_ENABLED||"").toLowerCase()==="true";
const toValue=process.env.ALERT_EMAIL_TO||"";
const from=process.env.ALERT_EMAIL_FROM||"";
const apiKey=process.env.RESEND_API_KEY||process.env.EMAIL_API_KEY||"";
const months=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const sources={admin:"Admin","admin-test-alert":"Uji Notifikasi Sistem","payment-proof-upload":"Bukti Pembayaran",web:"Aplikasi",system:"Sistem"};
const clean=(value)=>String(value||"").trim();
const recipients=()=>clean(toValue).split(",").map((item)=>item.trim()).filter(Boolean);
function periodLabel(value){const match=/^(\d{4})-(\d{2})$/.exec(clean(value));if(!match)return clean(value)||"-";const month=months[Number(match[2])-1];return month?`${month} ${match[1]}`:clean(value);}
function sourceLabel(value){const key=clean(value).toLowerCase()||"admin";return sources[key]||key.replace(/^admin-/,"").replace(/-/g," ").replace(/\b\w/g,(char)=>char.toUpperCase());}
function subjectOf({source,period,subject}){if(clean(subject))return clean(subject);const suffix=clean(period)&&period!=="-"?` - ${periodLabel(period)}`:"";return `[Amarta Kas] ${sourceLabel(source)}${suffix}`;}
function bodyOf(message){return [clean(message)||"Notifikasi sistem tidak memiliki isi.","",`Dikirim: ${formatJakartaDateTime(new Date().toISOString(),"id-ID")} WIB`,"","Email ini dikirim otomatis oleh Sistem Kas Amarta Residence Blok E."].join("\n");}
function filesOf(value){return Array.isArray(value)?value.map((item)=>({path:clean(item?.path),filename:clean(item?.filename)||"lampiran"})).filter((item)=>/^https:\/\//i.test(item.path)):[];}

export function getEmailAlertDefaults(){return {enabled:envEnabled,to:recipients(),from,provider:"resend"};}

export async function sendAlertEmail({message,source="admin",period="-",subject,attachments=[]}={}){
  if(!envEnabled)return {ok:false,skipped:true,reason:"Email dinonaktifkan melalui environment"};
  try{if(!(await isEmailNotificationsEnabled()))return {ok:false,skipped:true,reason:"Email Notifications dinonaktifkan dari Settings"};}
  catch(error){console.error("Gagal membaca toggle Email Notifications",error);return {ok:false,skipped:true,reason:"Konfigurasi Email Notifications tidak tersedia"};}
  const to=recipients();
  if(!apiKey)return {ok:false,skipped:true,reason:"RESEND_API_KEY belum dikonfigurasi"};
  if(!from)return {ok:false,skipped:true,reason:"ALERT_EMAIL_FROM belum dikonfigurasi"};
  if(!to.length)return {ok:false,skipped:true,reason:"ALERT_EMAIL_TO belum dikonfigurasi"};
  if(!clean(message))return {ok:false,skipped:true,reason:"Isi notifikasi email kosong"};
  const files=filesOf(attachments);
  try{
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({from,to,subject:subjectOf({source,period,subject}),text:bodyOf(message),...(files.length?{attachments:files}:{})})});
    const responseText=await response.text();let data=null;try{data=responseText?JSON.parse(responseText):null;}catch{data={raw:responseText};}
    if(!response.ok){const error=`Gagal mengirim notifikasi email (${response.status}): ${responseText}`;console.error(error);return {ok:false,skipped:false,error,provider:"resend"};}
    return {ok:true,provider:"resend",to,id:data?.id||null,attachment_count:files.length};
  }catch(error){const text=error instanceof Error?error.message:"Gagal mengirim notifikasi email";console.error("Gagal mengirim notifikasi email",error);return {ok:false,skipped:false,error:text,provider:"resend"};}
}
