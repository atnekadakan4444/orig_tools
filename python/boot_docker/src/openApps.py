# Popen関数でアプリケーションを起動ためのライブラリ
import subprocess

# 変数宣言(以下は起動したいアプリのパス)
# Dockerデスクトップアプリのパス
DOCKER_DESKTOP = r'C:XXXXX\Docker\Docker Desktop.exe'
# OneNoteアプリのパス
ONENOTE = r'C:XXXXX\ONENOTE.EXE'
# OneNoteで開きたいノートのパス
ONENOTE_DOCKER = r'https://onedrive.live.com/XXXXX'
# VSCodeのパス
VSCODE = r'C:XXXXX\Microsoft VS Code\Code.exe'
# VSCodeで開きたいフォルダ
WORK_FOLDER = r'C:XXXXX'
# Chromeのパス
CHROME = r'C:XXXXX\chrome.exe'
# 視聴する動画のパス(Chromeで開きたいサイトのパス)
URL_UDEMY = '動画のURL'
# エクセルのパス
EXCEL = r'C:XXXXX\EXCEL.EXE'
# 開きたいエクセルファイルのパス
STUDY_RECORD = r'C:XXXXX\学習記録.xlsx'


def pOpenApps():
    # 各アプリのフォルダを探し、「~.exe」＞「プロパティ」からパスを取得したら成功した
    # 立ち上がるのが遅い順から並べた
    # subprocess.Popen([プログラムファイル, 開くファイル])
    #Docker Desktop
    subprocess.Popen(DOCKER_DESKTOP)
    #OneNote
    subprocess.Popen([ONENOTE, ONENOTE_DOCKER]) 
    #VSCode
    subprocess.Popen([VSCODE, WORK_FOLDER]) 
    #Chrome
    subprocess.Popen([CHROME, URL_UDEMY]) 
    #EXCEL
    subprocess.Popen([EXCEL, STUDY_RECORD]) 
