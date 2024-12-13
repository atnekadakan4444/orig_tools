import smtplib
from email.mime.text import MIMEText
import my_outlook_account as outlook # アカウント情報

# メイン処理 --- (*1)
def send_test_email():
    # メールデータ(MIME)を作成
    msg = make_mime_text(
        mail_to=outlook.account,
        subject='メールの送信テスト',
        body='こんにちは。届きましたか？テストテスト。')
    # メール送信
    send_outlook_mail(msg)

# メールデータ(MIME)を生成する --- (*2)
def make_mime_text(mail_to, subject, body):
    msg = MIMEText(body, 'plain')
    msg['Subject'] = subject      # 件名
    msg['To'] = mail_to           # 宛先
    msg['From'] = outlook.account # 送信元
    return msg

# Outlookのサーバーに接続 --- (*3)
def send_outlook_mail(msg):
    # Outlookのサーバーに接続 --- (*4)
    server = smtplib.SMTP(
        'smtp.office365.com', 587)
    server.ehlo()
    server.starttls()
    server.ehlo()
    # ログインしてメールを送信
    server.login(
        outlook.account,
        outlook.password)
    server.send_message(msg)

if __name__ == '__main__':
    send_test_email()
    print('ok.')

