const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

let songs = [];

// Ensure the database directory exists
const databasePath = path.join(__dirname, '../database');
if (!fs.existsSync(databasePath)) {
  fs.mkdirSync(databasePath, { recursive: true });
}

// Configure Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, databasePath);
  },
  filename: (req, file, cb) => {
    cb(null, path.basename(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /audio\/mpeg|audio\/mp3/;
    if (!allowedTypes.test(file.mimetype)) {
      return cb(new Error('Invalid file type. Only MP3 files are allowed.'));
    }
    cb(null, true);
  },
});

// Serve static files
router.use('/files', express.static(databasePath));
router.use('/favorites', express.static(path.join(databasePath, 'favorites')));

// Upload a new song
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded or invalid file type.' });
  }

  const { filename } = req.file;
  const title = req.body.title || filename;
  const desc = req.body.desc || 'No descriptions are here';

  const newSong = {
    id: songs.length + 1,
    title,
    desc,
    updatedAt: new Date(),
  };
  songs.push(newSong);

  res.json({ message: 'File uploaded successfully.', song: newSong });
});

// Fetch all songs
router.get('/', (req, res) => {
  res.json(songs);
});

// Fetch favorite songs
router.get('/favorites', (req, res) => {
  const favoritesPath = path.join(databasePath, 'favorites');
  if (!fs.existsSync(favoritesPath)) {
    fs.mkdirSync(favoritesPath);
  }

  const favoriteFiles = fs.readdirSync(favoritesPath).map((file, index) => ({
    id: index + 1,
    title: file,
    desc: 'Favorite song',
  }));

  res.json(favoriteFiles);
});

// Add to favorites
router.post('/favorites', (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ message: 'Title is required to add to favorites.' });
  }

  const sourcePath = path.join(databasePath, title);
  const favoritesPath = path.join(databasePath, 'favorites');
  const targetPath = path.join(favoritesPath, title);

  if (!fs.existsSync(sourcePath)) {
    return res.status(404).json({ message: 'Song not found in the database.' });
  }

  if (!fs.existsSync(favoritesPath)) {
    fs.mkdirSync(favoritesPath);
  }

  if (!fs.existsSync(targetPath)) {
    fs.copyFileSync(sourcePath, targetPath);
    res.json({ message: 'Added to favorites successfully.' });
  } else {
    res.status(400).json({ message: 'Song already in favorites.' });
  }
});

// Update favorite song
router.put('/favorites/:id', upload.single('file'), (req, res) => {
  const favoritesPath = path.join(databasePath, 'favorites');
  const favoriteFiles = fs.readdirSync(favoritesPath);
  const { id } = req.params;

  if (id < 1 || id > favoriteFiles.length) {
    return res.status(404).json({ message: 'Favorite not found.' });
  }

  const oldFileName = favoriteFiles[id - 1];
  const oldFilePath = path.join(favoritesPath, oldFileName);

  const title = req.body.title || oldFileName;
  const desc = req.body.desc || 'Updated favorite song';
  const ext = path.extname(oldFileName);
  const newFilePath = path.join(favoritesPath, title + ext);

  if (req.file) {
    // Replace file if new file is uploaded
    fs.unlinkSync(oldFilePath);
    fs.renameSync(req.file.path, newFilePath);
  } else {
    // Rename existing file
    fs.renameSync(oldFilePath, newFilePath);
  }

  const updatedFavorite = {
    id: parseInt(id),
    title: title + ext,
    desc,
  };

  res.json({ message: 'Favorite updated successfully.', favorite: updatedFavorite });
});

// Remove from favorites
router.delete('/favorites/:id', (req, res) => {
  const { id } = req.params;
  const favoritesPath = path.join(databasePath, 'favorites');
  const favoriteFiles = fs.readdirSync(favoritesPath);
  const fileToRemove = favoriteFiles[id - 1];

  if (fileToRemove) {
    fs.unlinkSync(path.join(favoritesPath, fileToRemove));
    res.json({ message: 'Removed from favorites successfully.' });
  } else {
    res.status(404).json({ message: 'Favorite not found.' });
  }
});

// Update a song
router.put('/:id', upload.single('file'), (req, res) => {
  const song = songs.find((s) => s.id === parseInt(req.params.id));
  if (!song) {
    return res.status(404).json({ message: 'Song not found.' });
  }

  const title = req.body.title || song.title;
  const desc = req.body.desc || song.desc;
  const ext = path.extname(song.title);

  const oldFilePath = path.join(databasePath, song.title);
  const newFilePath = path.join(databasePath, title + ext);

  if (fs.existsSync(oldFilePath)) {
    fs.renameSync(oldFilePath, newFilePath);
  }

  song.title = title + ext;
  song.desc = desc;
  song.updatedAt = new Date();

  res.json({ message: 'Song updated successfully.', song });
});

// Delete a song
router.delete('/:id', (req, res) => {
  const songIndex = songs.findIndex((s) => s.id === parseInt(req.params.id));
  if (songIndex === -1) {
    return res.status(404).json({ message: 'Song not found.' });
  }

  const deletedSong = songs.splice(songIndex, 1)[0];
  const filePath = path.join(databasePath, deletedSong.title);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  res.json({ message: 'Song deleted successfully.' });
});

module.exports = router;

