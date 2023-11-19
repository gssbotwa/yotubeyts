const express = require('express');
const ytdl = require('ytdl-core-discord'); // Use ytdl-core-discord instead of ytdl-core
const ytSearch = require('yt-search');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/download', async (req, res) => {
  try {
    const query = req.query.query || req.query.link;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter or link is missing.' });
    }

    const isLink = ytdl.validateURL(query);

    let videoInfo;
    if (isLink) {
      videoInfo = await ytdl.getInfo(query, { filter: 'audioonly' });
    } else {
      const searchResults = await ytSearch(query);
      if (!searchResults.videos.length) {
        return res.status(404).json({ error: 'No videos found for the given query.' });
      }

      videoInfo = await ytdl.getInfo(searchResults.videos[0].url, { filter: 'audioonly' });
    }

    if (!videoInfo || !videoInfo.formats || videoInfo.formats.length === 0) {
      return res.status(404).json({ error: 'No suitable formats found for the video.' });
    }

    const audioFormat = ytdl.chooseFormat(videoInfo.formats, { quality: 'highestaudio' });

    if (!audioFormat || !audioFormat.url) {
      return res.status(404).json({ error: 'No suitable audio format found for the video.' });
    }

    const result = {
      title: videoInfo.videoDetails.title,
      downloadURL: audioFormat.url,
    };

    console.log('Download result:', result);
    res.json(result);
  } catch (error) {
    console.error('Error during download:', error);
    res.status(500).json({ error: 'An error occurred during download.' });
  }
});


app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
