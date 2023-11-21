const express = require('express');
const ytsr = require('ytsr');
const ytdl = require('ytdl-core');
const moment = require('moment');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const port = process.env.PORT || 8080;

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
        searchResults = await ytsr(searchQuery, { limit: 10 });
        searchCache.set(searchQuery, searchResults);
      } else {
        searchResults = searchCache.get(searchQuery);
      }

      if (!searchResults || !searchResults.items || searchResults.items.length === 0) {
        res.json({ error: 'No search results found.' });
        return;
      }

      if (!select) {
        const numberedResults = searchResults.items.map((item, i) => {
          return `${i + 1}. ${item.title}`;
        });

        res.json({ type: 'search', data: numberedResults });
      } else if (!formateselect) {
        const formatOptions = ['audio', 'video'];
        const numberedFormatOptions = formatOptions.map((format, i) => `${i + 1}. [${format}]`);

        res.json({ type: 'selectFormat', data: numberedFormatOptions });
      } else {
        const index = parseInt(select);

        if (!isNaN(index) && index >= 1 && index <= 10) {
          const selectedVideo = searchResults.items[index - 1];

          if (selectedVideo) {
            if (formateselect === '1') {
              const audioInfo = await ytdl.getInfo(selectedVideo.url);

              res.json({
                type: 'downloadAudio',
                data: {
                  title: selectedVideo.title,
                  downloadUrl: audioInfo.formats.find(format => format.mimeType.includes('audio/mp4')).url,
                },
              });
            } else if (formateselect === '2' && selectedVideo.type === 'video') {
              const videoFormats = await ytdl.getInfo(selectedVideo.url);

              if (videoFormats && videoFormats.formats) {
                const audioAndVideoFormats = videoFormats.formats.filter(format => format.hasAudio && format.hasVideo);

                if (audioAndVideoFormats.length > 0) {
                  const selectedFormat = audioAndVideoFormats[0]; // You can customize the selection logic if needed

                  res.json({
                    type: 'downloadVideo',
                    data: {
                      title: selectedVideo.title,
                      downloadUrl: selectedFormat.url,
                    },
                  });
                } else {
                  res.json({ error: 'No suitable video format with audio found.' });
                }
              } else {
                res.json({ error: 'Error fetching video formats.' });
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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
