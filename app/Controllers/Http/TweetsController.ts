// import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { schema, rules } from '@ioc:Adonis/Core/Validator'
// import User from "App/Models/User";
import TwitterAccount from "App/Models/TwitterAccount";
import Tweets from "App/Models/Tweet";
import axios from 'axios';

export default class TweetsController {
    public async app({ view, request, response, auth }: HttpContextContract) {
      const page = request.input('page', 1)
      const limit = 5
      const user = auth.user;

      if(user) {
        const accounts = await TwitterAccount.query().where('user_id', user.id).paginate(page, limit);
        const tweets = await Tweets.query().where('user_id', user.id);
        accounts.baseUrl('/app')
        return view.render('app', { accounts, tweets })
      }
      else {
        return response.redirect().toRoute('auth.login.show')
      }
    }

    public async tweets({ params, view, request, response, auth }: HttpContextContract) {
      let user = auth.user;
      let twitterAccount = await user?.related('TwitterAccount').query().where('account', params.account).firstOrFail();
      if(user && twitterAccount) {
        const tweets = await Tweets.query().where('user_id', user.id);
        return view.render('tweets', { tweets })
      }
    }

    public async addAccount({ request, response, auth }: HttpContextContract) {
      // check if account already exists in database for user
      const user = auth.user;
      const account = request.input('account')
      const twitterAccount = await user?.related('TwitterAccount').query().where('account', account).first();
      // twitter api call to check if account exists
      const token = "AAAAAAAAAAAAAAAAAAAAAMJhbQEAAAAAWvwo3qwlN5D1pWpKl%2BNi98bGtDM%3DzYCPTQAGKL6CjTo3ceQA1Hw5vNmRnmUzZbsZHwPgOEjTOxzl6B"
      let accountExistsOnTwitter = await axios.get(`https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name=${account}&count=1/users`, { headers: {"Authorization" : `Bearer ${token}`} }).then((response) => {
        return true
      }).catch((error) => {
        return false
      })


      
      if(auth.user) {
        const accountAdd = schema.create({
          account: schema.string(),
          category: schema.string(),
        })

        const data = await request.validate({ schema: accountAdd })

        if(!twitterAccount && accountExistsOnTwitter) {
          await TwitterAccount.create({
            account: data.account,
            category: data.category,
            userId: auth.user.id
          }) 
          return response.redirect().back();
        }
        else {
          // redirect back
          return response.redirect().back();
        }
      }
    }

    public async deleteAccount({ params, request, response, auth }: HttpContextContract) {
      const user = auth.user;

      if(user) {
        await TwitterAccount.query().where('account', params.accountName).where('user_id', user.id).delete()
      }
    }

    public async dashboard({ request, response, auth, session, view }: HttpContextContract) {
      // grab uid and password values off request body
      const user = auth.user;

      if (user) {
        return view.render('dashboard')
      }
      else {
        return response.redirect().toRoute('auth.login.show')
      }
    }

    public async settings({ request, response, auth, session, view }: HttpContextContract) {
      // grab uid and password values off request body
      const user = auth.user;

      if (user) {
        return view.render('settings')
      }
      else {
        return response.redirect().toRoute('auth.login.show')
      }
    }

    public async singleTweet({ request, response, auth, session, view }: HttpContextContract) {
      // grab uid and password values off request body
      const user = auth.user;

      if (user) {
        return view.render('single-tweet')
      }
      else {
        return response.redirect().toRoute('auth.login.show')
      }
    }

    public async screenshot({ params, response, auth }: HttpContextContract) {
      if(params.username) {
        if(!auth.user) {
          return response.status(401)
        }
        const user = auth.user;
        const twitterAccount = await user.related('TwitterAccount').query().where('account', params.username).firstOrFail();

        const puppeteer = require("puppeteer");
        const axios = require('axios');
        const chromium = require('chromium');
        const token = "AAAAAAAAAAAAAAAAAAAAAMJhbQEAAAAAWvwo3qwlN5D1pWpKl%2BNi98bGtDM%3DzYCPTQAGKL6CjTo3ceQA1Hw5vNmRnmUzZbsZHwPgOEjTOxzl6B"
        let responseTweet = await axios.get(`https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name=${twitterAccount.account}&count=1/users`, { headers: {"Authorization" : `Bearer ${token}`} }).then(res => {
            return res.data[0].id_str
          })
          .catch(error => {
            console.error(error);
        });
        let screenshotFile = `./public/tweets/${twitterAccount.account}-${responseTweet}.jpg`

        if (responseTweet) {
          puppeteer
          .launch({
            defaultViewport: {
              width: 3840,
              height: 2160,
            },
            executablePath: chromium.path,
            headless: 'chrome',
          })
          .then(async (browser) => {
            const page = await browser.newPage();
            await page.goto(`https://twitter.com/${twitterAccount.account}/status/${responseTweet}`, { waitUntil: 'networkidle0' });
            await page.screenshot({
              path: screenshotFile,
              clip: {
                x: 1550,
                y: 0,
                width: 640,
                height: 1080
              }
            });
            await browser.close();
          });
          response.status(203)
           // Save tweet to database
          await Tweets.create({
            userId: user.id,
            twitter_accountId: twitterAccount.id,
            tweet: `/tweets/${twitterAccount.account}-${responseTweet}.jpg`
          })
        }
        else {
          response.status(204)
        }
      }
      else {
        response.status(401);
      }
    }

    public async screenshotSpecific({ params, request, response, auth }: HttpContextContract) {
      const user = auth.user;

      if(user) {
        if(params.url) {
          const puppeteer = require("puppeteer");
          const chromium = require('chromium');
          let id = decodeURIComponent(params.url).split('/')[5];
          let accountName = decodeURIComponent(params.url).split('/')[3];
          let screenshotFile = `./public/tweets/${accountName}-${id}.jpg`

          if (params.url) {
            let newUrl = decodeURIComponent(params.url)
            puppeteer
            .launch({
              defaultViewport: {
                width: 3840,
                height: 2160,
              },
              executablePath: chromium.path,
              headless: 'chrome',
            })
            .then(async (browser) => {
              const page = await browser.newPage();
              await page.goto(`${newUrl}`, { waitUntil: 'networkidle0' });
              await page.screenshot({ 
                path: screenshotFile,
                clip: {
                  x: 1550,
                  y: 0,
                  width: 640,
                  height: 1080
                }
              });
              await browser.close();
            });
            response.status(203)

            await Tweets.create({
              userId: user.id,
              tweet: `/tweets/${accountName}-${id}.jpg`
            })
          }
          else {
            response.status(204)
          }
        }
        else {
          response.status(401);
        }
      }
    }

    // GET LATEST TWEET
    // "https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name=" + username + '&count=1/users';
    
    // NAME THE FILE
    // "./public/tweets/" + encodeURIComponent(`https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name=${username}&count=1/users` + '.jpg')

    // SCREENSHOT CONFIGURATION
    // puppeteer
    //   .launch({
    //     defaultViewport: {
    //       width: 3840,
    //       height: 2160,
    //     },
    //   })
    //   .then(async (browser) => {
    //     const page = await browser.newPage();
    //     await page.goto(`https://twitter.com/${username}/status/${tweetID}`);
    //     await page.screenshot({ path: "./public/tweets/" + encodeURIComponent(`https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name=${username}&count=1/users` + '.jpg')" });
    //     await browser.close();
    //   });
}
