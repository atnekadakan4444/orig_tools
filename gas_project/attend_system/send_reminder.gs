/*=================================================================
・レコードを全て取得
・本日の出席者のメールアドレスだけを取得
・宛先のメールアドレスに送信
=================================================================*/

function process_send_email() {
  // URLより対象のスプレッドシートのシートをすべて取得
  let targetSpreadSheet = SpreadsheetApp.openById(SPREAD_SHEET_URI).getSheets();
  // シートの1つめを対象とする
  targetSheet = targetSpreadSheet[0];
  // レコード全取得
  all_records = targetSheet.getRange(2, 1, targetSheet.getLastRow(), targetSheet.getLastColumn()).getValues();
  // 本日の年月日を取得
  today = new Date();
  today_year = today.getFullYear();
  today_month = today.getMonth();
  today_date = today.getDate();
  // リストの宛先、本日送信する宛先の2つを取得
  [all_address_ary, today_attend_address_ary] = check_today_record(all_records, today_year, today_month, today_date);
  // 本日の宛先メールから特定の宛先を削除
  send_address_ary = except_send_email(all_address_ary);
  // 本日の宛先メールのだけに送信
  send_remainder(send_address_ary, today_attend_address_ary, today_year, today_month, today_date);
}

/*=================================================================
・本日の出席者のメールアドレスだけを取得
=================================================================*/
function check_today_record(all_records, year, month, date) {
  let all_address_ary = [];
  let today_attend_address_ary = [];

  for(let i=0; i<all_records.length; i++){
    let records = all_records[i];  // 行のレコードすべて
    let d = records[0]; // 記録の日時
    let attend_status = records[2]; // 出欠ステータス
    let email = records[4]; // メールアドレス
    
    // メールアドレスがnullの場合は処理をしない
    if(email){
      // メールアドレスを格納する
      all_address_ary.push(email);

      // 日付が今日のレコードだけを取得する
      if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === date) {
        // メールアドレスを取得済み&本日の出欠が"出席"である場合に送信先として格納
        if(email && attend_status === "出席"){
          today_attend_address_ary.push(email);
        }
      }
    }
  }
  // Setで重複を取り除きデータ型を配列に戻す
  all_address_ary = Array.from(new Set(all_address_ary));
  today_attend_address_ary = Array.from(new Set(today_attend_address_ary));

  // return:送信する宛先だけを格納した配列, 本日出席する人の宛先の配列
  return [all_address_ary, today_attend_address_ary];
}

/*=================================================================
・特定の宛先だけは除く
=================================================================*/
function except_send_email(all_address_ary) {
  let except_result = all_address_ary.filter(e => !EXCEPT_EMAIL_ARY.includes(e));
  
  console.log(except_result);
  return except_result;
}


/*=================================================================
・本日の出席者のメールアドレスだけを取得
=================================================================*/
function send_remainder(send_address_ary, today_attend_address_ary, today_year, today_month, today_date) {
  // メールの内容について設定
  let mail_subject = `【RUNTEQ_夜アウトプット会 リマインドメール】 - ${ today_year }/${ today_month }/${ today_date }`;
  let mail_body = `
【※返信は不要です。返信をいただいても回答できません。】

皆さんお疲れ様です。
${ today_year }/${ today_month }/${ today_date } のRUNTEQ - 夜アウトプット会のリマインドメールになります。


現時点で本日の参加者は 【 ${ today_attend_address_ary.length }  名 】 となっております。


まだ出席回答をされていない方は取り急ぎよろしくお願いいたします。
（※欠席される方はフォームの回答は不要です）




もし出席申請を済みで都合が悪くなり欠席に変更したい場合は、回答時に届いた回答確認メールより回答の編集を行ってください。

`;
  // メール送信
  GmailApp.sendEmail(send_address_ary, mail_subject, mail_body, { from: FROM_EMAIL_ADDRESS });
}
