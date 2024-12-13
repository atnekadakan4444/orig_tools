// common parameter
const SPREAD_SHEET_URI = '使っているスプレッドシートのURL'; // スプレッドシート識別子
const TARGET_FORM = FormApp.getActiveForm(); // 対象のフォーム

// main.gs
const OPEN_TRIGGER = 'formOpenFunc'; // トリガー名
const CLOSE_TRIGGER = 'formCloseFunc'; // トリガー名
const SEND_MAIL_TRIGGER = 'process_send_email'; // トリガー名

// setting_radio_btn.gs
const TARGET_COLUMN_NAME = '参加者名'; // 対象カラム

// send_reminder.gs
const TARGET_COLUMN_EMAIL = 'メールアドレス'; // 対象カラム
const FROM_EMAIL_ADDRESS = "送信元のメアド";
const EXCEPT_EMAIL_ARY = [
                            '宛先から除きたいメアド',
                         ];
