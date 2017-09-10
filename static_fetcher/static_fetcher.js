const AWS = require('aws-sdk')
const qs = require('querystring')
const Promise = require('bluebird')
const rp = require('request-promise')

if (process.argv.length < 3) {
    console.log("Must pass in riot api key as command line argument")
    process.exit(1)
}

AWS.config.setPromisesDependency(Promise)

const S3_BUCKET = "static.asuna.io"
const RIOT_API_KEY = process.argv[2]
const RIOT_HOST = "api.riotgames.com"

const patchVersionMap = {
    5.2: "5.2.2",
    4.18: "4.18.1",
    5.10: "5.10.1",
    6.3: "6.3.1",
    6.9: "6.9.1",
    7.17: "7.17.2",
    4.14: "4.14.2",
    5.21: "5.21.1",
    5.9: "5.9.1",
    5.22: "5.22.3",
    4.8: "4.8.3",
    7.3: "7.3.3",
    4.10: "4.10.7",
    6.13: "6.13.1",
    6.16: "6.16.2",
    6.24: "6.24.1",
    5.11: "5.11.1",
    7.8: "7.8.1",
    6.19: "6.19.1",
    7.6: "7.6.1",
    5.6: "5.6.2",
    4.17: "4.17.1",
    6.7: "6.7.1",
    5.15: "5.15.1",
    5.3: "5.3.1",
    6.4: "6.4.2",
    7.13: "7.13.1",
    6.15: "6.15.1",
    4.19: "4.19.3",
    7.2: "7.2.1",
    4.13: "4.13.1",
    4.9: "4.9.1",
    7.10: "7.10.1",
    5.18: "5.18.1",
    7.16: "7.16.1",
    6.23: "6.23.1",
    5.7: "5.7.2",
    4.16: "4.16.1",
    6.8: "6.8.1",
    7.9: "7.9.2",
    5.14: "5.14.1",
    4.6: "4.6.3",
    6.12: "6.12.1",
    5.13: "5.13.1",
    5.24: "5.24.2",
    7.5: "7.5.2",
    6.1: "6.1.1",
    6.20: "6.20.1",
    7.1: "7.1.1",
    4.12: "4.12.2",
    6.5: "6.5.1",
    4.15: "4.15.1",
    7.15: "7.15.1",
    5.17: "5.17.1",
    7.11: "7.11.1",
    5.1: "5.1.2",
    6.18: "6.18.1",
    6.11: "6.11.1",
    5.5: "5.5.3",
    5.8: "5.8.1",
    5.19: "5.19.1",
    5.12: "5.12.1",
    5.23: "5.23.1",
    6.22: "6.22.1",
    7.4: "7.4.3",
    4.21: "4.21.5",
    6.2: "6.2.1",
    5.20: "5.20.1",
    6.10: "6.10.1",
    6.17: "6.17.1",
    5.16: "5.16.1",
    4.20: "4.20.2",
    6.6: "6.6.1",
    4.7: "4.7.16",
    7.12: "7.12.1",
    6.14: "6.14.2",
    7.14: "7.14.1",
    7.7: "7.7.1",
    4.11: "4.11.3",
    5.4: "5.4.1",
    6.21: "6.21.1"
}

const platforms = [
    "BR1",
    "EUN1",
    "EUW1",
    "JP1",
    "KR",
    "LA1",
    "LA2",
    "NA1",
    "OC1",
    "RU",
    "TR1",
]

const versions = Object.values(patchVersionMap).sort().reverse()

const s3 = new AWS.S3({apiVersion: '2006-03-01'})
const uploadToS3 = (platform, version, type, data) => {
    return s3.upload({
        Bucket: S3_BUCKET,
        Key: `league/riot/${version}/${platform}/en_US/${type}`,
        Body: data
    }).promise().then(x => type)
}

const storeStatic = (platform, version, type, query = {}) => {
    const q = qs.stringify({
        ...query,
        version,
        locale: "en_US",
        api_key: RIOT_API_KEY
    })

    return rp(`https://${platform}.${RIOT_HOST}/lol/static-data/v3/${type}?${q}`)
        .then(res => uploadToS3(platform, version, type, res))
        .catch(err => {
            console.log(`${version}/${platform}: Failed to store ${type}: ${err}`)
            throw type
        })
}

let i = 0;
const fetchStatic = () => {
    const version = versions[i++]
    console.log(`\nFetching static for version ${version}`)

    Promise.all(
        platforms.map(platform => Promise.all([
            storeStatic(platform, version, 'champions', { tags: "all" }),
            storeStatic(platform, version, 'items', { tags: "all" }),
            storeStatic(platform, version, 'masteries', { tags: "all" }),
            storeStatic(platform, version, 'runes', { tags: "all" }),
            storeStatic(platform, version, 'summoner-spells', {dataById: "true", tags: "all"})
        ].map(x => x.reflect())).then(results => {
            const success = results.filter(x => x.isFulfilled()).map(x => x.value())
            const failed = results.filter(x => !x.isFulfilled()).map(x => x.reason())

            if (success.length == 5)
                return version

            console.log(`${version}/${platform} - Failed: ${failed.join(" ")}`)
            return version
        })
      )
    ).then(x => console.log(`${x[0]} Complete`))
}

fetchStatic()
setInterval(fetchStatic, 60 * 60 * 1000)
