const express = require('express');
const ytsr = require('ytsr');
const ytdl = require('ytdl-core');
const moment = require('moment');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const port = process.env.PORT || 3000;

const searchCache = new Map();

app.get('/api', async (req, res) => {
  const searchQuery = req.query.search;
  const select = req.query.select;
  const formateselect = req.query.formateselect;
  const qualityselect = req.query.qualityselect;

  try {
    if (searchQuery) {
      let searchResults;

      if (!searchCache.has(searchQuery)) {
        // If search results are not in cache, fetch and store them
        searchResults = await ytsr(searchQuery, { limit: 10 });
        searchCache.set(searchQuery, searchResults);
      } else {
        // If search results are in cache, use them
        searchResults = searchCache.get(searchQuery);
      }

      if (!searchResults || !searchResults.items || searchResults.items.length === 0) {
        res.json({ error: 'No search results found.' });
        return;
      }

      if (!select) {
        // If no select parameter is provided, show numbered titles for search results
        const numberedResults = searchResults.items.map((item, i) => {
          return `${i + 1}. ${item.title}`;
        });

        res.json({ type: 'search', data: numberedResults });
      } else if (!formateselect) {
        // If select parameter is provided, but not formateselect, show options to select format
        const formatOptions = ['audio', 'video'];
        const numberedFormatOptions = formatOptions.map((format, i) => `${i + 1}. [${format}]`);

        res.json({ type: 'selectFormat', data: numberedFormatOptions });
      } else if (!qualityselect && formateselect === '2') {
        // If qualityselect parameter is not provided and formateselect is '2' (video), show options to select video quality
        const index = parseInt(select);

        if (!isNaN(index) && index >= 1 && index <= 10) {
          const selectedVideo = searchResults.items[index - 1];

          if (selectedVideo && selectedVideo.type === 'video') {
            const availableQualities = await getVideoQualities(selectedVideo.url);
            const numberedQualityOptions = availableQualities.map((quality, i) => `${i + 1}. [${quality}]`);

            res.json({ type: 'selectQuality', data: numberedQualityOptions });
          } else {
            res.json({ error: 'Invalid selection. Please provide valid video indexes between 1 and 10.' });
          }
        } else {
          res.json({ error: 'Invalid selection. Please provide valid video indexes between 1 and 10.' });
        }
      } else {
        // If all parameters are provided, fetch details and handle download
        const index = parseInt(select);

        if (!isNaN(index) && index >= 1 && index <= 10) {
          const selectedVideo = searchResults.items[index - 1];

          if (selectedVideo) {
            if (formateselect === '1') {
              // For audio, download audio and convert to MP3
              const audioStream = ytdl(selectedVideo.url, { quality: 'highestaudio' });
              res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(selectedVideo.title)}.mp3"`);
              
              ffmpeg()
                .input(audioStream)
                .audioCodec('libmp3lame')
                .toFormat('mp3')
                .on('end', () => res.end())
                .pipe(res, { end: true });
            } else if (formateselect === '2' && selectedVideo.type === 'video') {
              // For video, download video with the selected quality
              const selectedQualityIndex = parseInt(qualityselect);

              if (!isNaN(selectedQualityIndex) && selectedQualityIndex >= 1) {
                const selectedQuality = (await getVideoQualities(selectedVideo.url))[selectedQualityIndex - 1];
                const videoStream = ytdl(selectedVideo.url, { quality: selectedQuality });
                res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(selectedVideo.title)}.mp4"`);
                videoStream.pipe(res);
              } else {
                res.json({ error: 'Invalid quality selection. Please provide a valid quality index.' });
              }
            } else {
              res.json({ error: 'Invalid format selection. Please choose either "1" for audio or "2" for video.' });
            }
          } else {
            res.json({ error: 'Invalid selection. Please provide valid video indexes between 1 and 10.' });
          }
        } else {
          res.json({ error: 'Invalid selection. Please provide valid video indexes between 1 and 10.' });
        }
      }
    } else {
      res.json({ error: 'Please provide a search query.' });
    }
  } catch (error) {
    console.error(error);
    res.json({ error: 'Error processing request.' });
  }
});

async function getVideoQualities(videoUrl) {
  const info = await ytdl.getInfo(videoUrl);
  const videoFormats = ytdl.filterFormats(info.formats, 'videoonly');
  const uniqueQualities = [...new Set(videoFormats.map(format => format.qualityLabel))];
  return uniqueQualities;
}

// Add a new function to sanitize filenames
function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9]/g, '_');
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
