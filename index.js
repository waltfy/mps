var _ = require('lodash')
var cheerio = require('cheerio');
var net = require('request-promise');
var fs = require('fs');

var CONSTS = {
    FILE_PATH: 'mps.json',
}

var UTILS = {
    cheerioTransform: function cheerioTransform(body) {
        return cheerio.load(body);
    },
    getAttr: function getAttr($, el, attr) {
        return $(el).attr(attr)
    },
    getText: function getText($, el) {
        return $(el).text();
    },
    getPage: function getPage(uri, options) {
        return net({
            uri: uri,
            transform: UTILS.cheerioTransform,
        });
    },
}

var personalDetailsSelectors = {
    emails: {
        selector: 'a[href*="mailto:"]',
        fn: UTILS.getText,
    },
    facebook: {
        selector: 'a[href*="facebook"]',
        fn: _.partialRight(UTILS.getAttr, 'href'),
    },
    twitter: {
        selector: 'a[href*="twitter"]',
        fn: _.partialRight(UTILS.getAttr, 'href'),
    },
};

function scrapeMemberInformation(mp) {
    var res = _.cloneDeep(mp);
    return UTILS
        .getPage(mp.link)
        .then(function($) {

            _.each(
                personalDetailsSelectors,
                function (spec, key) {
                    var selectorResults = _.uniq(
                        _.toArray($(spec.selector))
                            .map(function (el) {
                                return spec.fn($, el);
                            })
                    );

                    _.set(res, key, selectorResults);
                }
            );

            return res;
        });
}

UTILS
    .getPage('http://www.parliament.uk/mps-lords-and-offices/mps/')
    .then(function($) {
        return _.toArray($('a[href*="http://www.parliament.uk/biographies/commons"]'))
            .map(function(el) {
                var mp = $(el);

                return {
                    name: mp.text(),
                    link: mp.attr('href'),
                }
            });
    })
    .then(function(list) {
        return Promise.all(list.map(scrapeMemberInformation))
    })
    .then(function(list) {
        return new Promise(function(resolve, reject) {
            fs.writeFile(CONSTS.FILE_PATH, JSON.stringify(list, null, 4), function(err) {
                if (_.isNull(err)) {
                    resolve(list);
                } else {
                    reject(err);
                }
            })
        });
    })
    .then(function(list) {
        console.log('written', list.length, 'details of members of parliament to', CONSTS.FILE_PATH);
    });
