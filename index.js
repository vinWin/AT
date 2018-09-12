const https = require('https');
var fs = require('fs');
var config = {
    urlToGoTo : 'http://microsites.partnersite.mobi/hannaford/hannaford.html#hannaford/hannaford',
    buttontoClick: '#header_click',
    tile:'#mainColumn a'
};

var
    binaryPack = require('./lib/bootstrap/nightmare-lambda-pack'), // WIP: should be `require('nightmare-lambda-pack')`
    Xvfb       = require('./lib/bootstrap/xvfb'),                  // WIP: should be `require('xvfb')`
    Nightmare  = require('nightmare')
;

var isOnLambda = binaryPack.isRunningOnLambdaEnvironment;

var electronPath = binaryPack.installNightmareOnLambdaEnvironment();

var POST_OPTIONS = {
    hostname: 'hooks.slack.com',
    port:443,
    path:'/services/T02GV1KPP/BC77RH7TR/4ZIHGpHuvLU3RbrsCG4bjZP0',
    method:'POST',
    headers:{
        'Content-Type':'application/json'
    }
};
var slackMessage = {
    'text':'Testing Microzine - Hannaford',
    'attachments': [
        {
            'text': '',
            'color': '',
            'title': '',
        },
    ],
};

exports.handler = (event, context, callback) => {
    // TODO implement
    console.log("begin Lambda-canary");
    // load web site
    var xvfb = new Xvfb({
        xvfb_executable: '/tmp/pck/Xvfb',  // Xvfb executable will be at this path when unpacked from nigthmare-lambda-pack
        dry_run: !isOnLambda         // in local environment execute callback of .start() without actual execution of Xvfb (for running in dev environment)
    });

    xvfb.start((err, xvfbProcess) => {

        if (err) context.done(err);

        function done(err, result){
            xvfb.stop((err) => context.done(err, result));
        }

        // ...
        // Main logic with call to done() upon completion or error
        // ...
        var message = '';
        main().catch(console.error)

        async function main() {
            Nightmare.action('scrollIntoView', function (selector, done) {
                this.evaluate_now((selector) => {
                    // https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView
                    document.querySelector(selector).scrollIntoView(true)
                }, done, selector)
            })
            // define a new action
            Nightmare.action(
                'onBeforeRequest',
                //define the action to run inside Electron
                function (name, options, parent, win, renderer, done) {
                    win.webContents.session.webRequest.onBeforeRequest((details, cb) => {
                        // call our event handler
                        parent.call('onBeforeRequest', details, res => {
                            res ? cb(Object.assign({}, res)) : cb({cancel: false})
                        })
                    })
                    done()
                },
                function (handler, done) {
                    // listen for "onBeforeRequest" events
                    this.child.respondTo('onBeforeRequest', handler)
                    done()
                }
            )

            //  const nightmare = Nightmare({ show: true })
            const nightmare = Nightmare({
                show: true,                   // show actual browser window as Nightmare clicks through
                electronPath: electronPath    // you MUST specify electron path which you receive from installation
            });

            const filter = {
                urls: ['*://t.zumobi.com/*']
            }
            // var urls = ['*://t.zumobi.com/*'];

            // start listening
            nightmare.onBeforeRequest((details, cb) => {
                if (details.resourceType === 'image' && details.url.includes('/t.zumobi.com')) {
                    console.log(details.url);
                    return cb({cancel: true})
                }
                cb({cancel: false})
            })

            await nightmare
                .goto(config.urlToGoTo)
                .wait(5000)
                .scrollIntoView(config.tile)
                .wait(5000)
                .click(config.tile)
                .wait(3000)
                .back()
                .wait(3000)
                .click(config.buttontoClick)
                .evaluate(function () {
                    return window.location.href;
                })
                .then(function (result) {
                    message = true;
                    console.log("able to load the MZ  " + config.urlToGoTo + '   result   ' + result);
                    slackMessage.attachments[0].color = 'good';
                    slackMessage.attachments[0].text = 'success';
                    slackMessage.attachments[0].title = 'Able to load and verify MZ - Hannaford';
               //     nightmare.end();
                })
                .catch(function (error) {
                    if (error.code === -105) {
                        console.log('unable to load the MZ ' + config.urlToGoTo);
                        message = false;
                        slackMessage.attachments[0].color = 'danger';
                        slackMessage.attachments[0].text = 'fail';
                        slackMessage.attachments[0].title = 'Unable to load and verify MZ - Hannaford';                   }
               //     nightmare.end();
                }).then(function () {
              //  nightmare.end();
            })


                var req = https.request(POST_OPTIONS, function(res){
                    res.setEncoding('utf8');
                    res.on('data', function(chunk){
                        console.log("successfully sent slack message");
                    });
                })

                req.on('error', function(e){
                    console.log("problem with request" + e.message);

                });

                req.write(JSON.stringify(slackMessage));

                req.end();

            await nightmare.end();
            console.log("end lambda canary testing");
            done(null, 'Hello from Lambda');
        }
  })
}