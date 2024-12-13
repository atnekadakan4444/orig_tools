import smtplib
from datetime import datetime
from email.mime.text import MIMEText
import my_outlook_account as outlook #アカウント情報
# ダイアログ関連モジュール
import tkinter as tk
from tkinter import messagebox

#メイン処理
def send_email():
    #メールデータ(MIME)を作成
    msg = make_mime_text(
        mail_to = 'メアド(1), メアド(2)',
        mail_cc = 'メアド(3)',
        # mail_to = 'kato@n-k.jp,nakamura@n-k.jp',
        # mail_cc = 'okamoto@n-k.jp',
        subject = '出席状況,健康状況の報告_{date}_（なまえ）'.format(date=getToday()),
        body = """おはようございます。
（なまえ）です。

出社状況、健康状況をご報告させていただきます。

・勤務状況：在宅勤務
・健康状態：体調良好
・情報セキュリティ状況：遵守

以上、よろしくお願いいたします。

----------------------------------------------------
（なまえ）
株式会社　XXXXX
第一事業部
E-Mail: myメアド
----------------------------------------------------"""
    )
    #メール送信
    send_outlook_mail(msg)
    
def getToday():
    # 現在時刻を取得
    t = datetime.now()
    fmt = t.strftime('%m/%d')
    return fmt
    
#メールデータを生成する
def make_mime_text(mail_to, mail_cc, subject, body):
    msg = MIMEText(body, 'plain')
    msg['Subject'] = subject         #件名
    msg['To'] = mail_to              #宛先
    msg['Cc'] = mail_cc              #CC宛先
    msg['From'] = outlook.account    #送信元
    return msg
  
#Outlookサーバーに接続
def send_outlook_mail(msg):
    #Outlookのサーバーに接続
    server = smtplib.SMTP(
        'smtp.office365.com', 587
    )

    print(msg)

    server.ehlo()
    server.starttls()
    server.ehlo()
    # ログインしてメールを送信
    server.login(
        outlook.account,
        outlook.password
    )
    server.send_message(msg)
    
# # このファイルがスクリプトとして読み込まれたかどうかを判定
# if __name__ == '__main__': 
def setEmailInfo(): 
    send_email()
    print('ok.')
