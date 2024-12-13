# ファイルの呼び出し
import outlook_send as sendMail
# from outlook_auto import outlook_send

# ダイアログ関連モジュール
import tkinter as tk
from tkinter import messagebox

#Yes/No確認メッセージボックス
def confirmSendEmail():
    Messagebox = tk.messagebox.askquestion('最終確認','下記の内容で送信します。', icon='warning')
    if Messagebox == 'yes': #If関数
        print('yes')
        sendMail.setEmailInfo()
        tk.messagebox.showinfo('送信完了','メールの送信が完了しました。')
        
    else:
        print('no')
        tk.messagebox.showinfo('キャンセル','メールを送信せずに終了します。')
        
        
# ダイアログ画面表示の実行
if __name__ == '__main__': # このファイルがスクリプトとして読み込まれたかどうかを判定
    confirmSendEmail()