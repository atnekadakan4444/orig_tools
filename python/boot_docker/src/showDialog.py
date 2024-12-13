# アプリを開く処理ファイルの読込
import openApps

# ダイアログ関連モジュール
import tkinter as tk
from tkinter import messagebox

#Yes/No確認メッセージボックス
def confirmSendEmail():
    Messagebox = tk.messagebox.askquestion('確認','Docker学習の準備をしますか？', icon='warning')
    if Messagebox == 'yes': #If関数
        print('yes')
        openApps.pOpenApps()
        
    else:
        print('no')
        tk.messagebox.showinfo('キャンセル','終了します')
        
        
# ダイアログ画面表示の実行
if __name__ == '__main__': # このファイルがスクリプトとして読み込まれたかどうかを判定
    confirmSendEmail()