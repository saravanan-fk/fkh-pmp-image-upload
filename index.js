const express = require('express');
const compression = require('compression');

const upload = require('express-fileupload');
const AWS = require('aws-sdk');
const cors = require('cors');
require('dotenv').config();

const reactAppDistPath = __dirname + '/pmp-react/build';

const app = express();
const PORT = process.env.PORT || 3000;

const shouldgZipCompress = (req, res) => {
  // if (req.headers['x-no-compression']) {
  //   // don't compress responses with this request header
  //   return false;
  // }
  return compression.filter(req, res);
};

app.use(
  compression({
    filter: shouldgZipCompress,
  })
);

const fileExts = new RegExp(
  'css|js|cur|jpe?g|gif|htc|ico|png|xml|otf|ttf|eot|woff|woff2|svg'
);

const responseCacheHeaders = {
  etag: true,
  lastModified: true,
  setHeaders: (response, path, stat) => {
    if (fileExts.test(path)) {
      response.setHeader('Cache-Control', 'public max-age=31536000');
    }
  },
};
app.use(express.static(reactAppDistPath, responseCacheHeaders));

app.use(upload());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({limit: '50mb'}));

// s3 config
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

async function uploadFile(payload) {
  const { fileName, fileData } = payload;
  const base64Data = new Buffer.from(
    fileData.replace(/^data:image\/\w+;base64,/, ''),
    'base64'
  );
  const type = fileData.split(';')[0].split('/')[1];

  const params = {
    Bucket: process.env.AWS_BUCKET,
    Key: `creatives/${fileName}`,
    Body: base64Data,
    ACL: 'public-read',
    ContentEncoding: 'base64',
    ContentType: `image/${type}`,
  };
  const data = await s3.upload(params).promise();
  return data.Location;
}

app.get('/', (req, res) => {
  res.append('Cache-Control', 'no-cache');
  res.sendFile(`${reactAppDistPath}/index.html`);
});

app.post('/upload', async (req, res) => {
  const fileLocation = await uploadFile(req.body);
  return res.status(200).json({ url: fileLocation });
});

// for refresh redirect react app routes to index.html so that react router can take over
// can this be differentiated based on request type?? like fetch vs document
app.get('*', function (req, res, next) {
  res.append('Cache-Control', 'no-cache');
  res.sendFile(`${reactAppDistPath}/index.html`);
});

app.listen(PORT, () => console.log(`server started at PORT: ${PORT}`));
