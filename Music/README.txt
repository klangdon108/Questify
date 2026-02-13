Put your background music here.

Structure:
  Music/
    <Folder Name You Want Shown In App>/
      <somefile>.mp3

Then (re)generate Music/index.json by running:
  node tools/build_music_index.js

After that, open the app from a local web server (recommended):
  python -m http.server 8000
  (then open http://localhost:8000)
