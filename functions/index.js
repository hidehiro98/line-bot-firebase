'use strict';

const functions = require('firebase-functions');
const express = require('express');
const request = require('request');
const line = require('@line/bot-sdk');

// https://www.npmjs.com/package/microsoft-computer-vision
const microsofComputerVision = require("microsoft-computer-vision")

const config = {
  channelSecret: functions.config().line.channel_secret,
  channelAccessToken: functions.config().line.access_token
};
const app = express();
const client = new line.Client(config);

app.post('/webhook', line.middleware(config), (req, res) => {
  console.log(req.body.events);
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  //   if (event.type !== 'message' || event.message.type !== 'text') {
  if (event.type !== 'message') {
    return Promise.resolve(null);
  }

  if (event.message.type === 'text') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: event.message.text //実際に返信の言葉を入れる箇所
    });
  }

  //////////////////
  // 画像認識パート //
  /////////////////
  if (event.message.type === 'image') {
    // https://qiita.com/n0bisuke/items/17c795fea4c2b5571ce0
    // 上のLINE Developersドキュメントのコードだとうまくいかない。
    // chunkにresponseとbodyが一緒に入っている？
    // encoding: nullが設定されてないから？
    const message_id = event.message.id
    const options = {
      url: `https://api.line.me/v2/bot/message/${message_id}/content`,
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + functions.config().line.access_token,
      },
      encoding: null
    };
    request(options, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        console.log('Got responce');
        // visualRecognition.classify(body, function (result) {
        //     sendMessage.send(req, [ messageTemplate.textMessage(result) ]);
        //     return;
        // })

        microsofComputerVision.analyzeImage({
          "Ocp-Apim-Subscription-Key": functions.config().azure.computer_vision_key,
          "request-origin": "japaneast",
          "content-type": "application/octet-stream",
          "body": body,
          "visual-features": "Tags, Faces"
        }).then((result) => {
          console.log(result)
          const resultString = JSON.stringify(result)
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: resultString //実際に返信の言葉を入れる箇所
          });
          // resultの例
          // { tags:
          //  [ { name: 'tree', confidence: 0.9994124174118042 },
          //    { name: 'outdoor', confidence: 0.9984000325202942 },
          //    { name: 'sky', confidence: 0.9974111914634705 },
          //    { name: 'grass', confidence: 0.9564579725265503 },
          //    { name: 'building', confidence: 0.9447041153907776 },
          //    { name: 'castle', confidence: 0.6080892086029053 } ],
          // requestId: 'c9c33a0d-7100-4cea-b37a-b93d2b3aff10',
          // metadata: { width: 883, height: 589, format: 'Jpeg' },
          // faces: [] }
        }).catch((err) => {
          throw err
        })
      } else {
        // @todo handle error
      }
    });
  }
  ////////////////////////
  // 画像認識パートここまで //
  ////////////////////////
}

exports.app = functions.https.onRequest(app);
