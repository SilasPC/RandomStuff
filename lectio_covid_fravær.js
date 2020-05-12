
// Configuration
const username = ''
const password = ''
const safemode = false // Set to true if not using Windows
const delay = 1 // Delay in minutes after start to post note
const retro_delay = 5 // Allow posting notes for classes started a couple minutes earlier
const keep_open = false // Keep console window open after posting notes and auto scheduling
const notes = { // Notes are randomly picked from this list. Arrow functions get passed a SchemaBrick as first argument (see below)
    tgc : [ s => ['9:25','8:15'].includes(s.start) ? 'Godmorgen...' : '' ],
    erl: [ 'Tja.' ],
    _ : [ // Default notes. Empty strings get replaced by a default note (if chosen)
        'Er til time',
        'Er ved pc',
        'Mødt',
        'Er her'
    ]
}

/** SchemaBrick definition
 * @typedef {{
        startTime: number;
        date: number;
        month: number;
        year: number;
        start: string; // time format like 8:15
        end: string;   // same as above
        absid: string;
        team: string;
        teacher: string;
        teacher_alias: string;
    }} SchemaBrick
*/

// Dependencies
let cheerio, FormData, fetch, child_process
try {
    cheerio = require('cheerio')
    FormData = require('form-data')
    fetch = require('fetch-cookie')(require('node-fetch'));
    child_process = require('child_process')
} catch {
    console.log(`You are missing some dependencies. Install with 'npm i -g cheerio form-data fetch-cookie node-fetch'`)
    process.exit()
}

// Main
; (async function () {
    let argv = [...process.argv]
    if (argv[2] == 'keepopen') {
        if (keep_open) setInterval(() => { }, 1000)
        argv.splice(2, 1)
    }
    switch (argv[2]) {
        case 'post': {
            console.log('Logging in...')
            const id = await login(username, password)
            const s = (await get_schema(id)).filter(s=>s.absid == argv[3])[0]
            console.log(`Posting absense note... (${s.team}, ${s.teacher_alias}, ${s.start})`)
            await post_absense_note(id, s)
            console.log(`Note posted.`)
            return
        }
        case 'cancel': {
            if (safemode) {
                console.log(`'cancel' not supported in safe mode.`)
                return
            }
            const count = await cancel_all()
            console.log(`Canceled ${count} absense post${(count - 1) ? 's' : ''}.\nNote: Auto rescheduling must still be disabled with the "noauto" option.`)
            return
        }
        case 'noauto': {
            if (safemode) {
                console.log(`'noauto' not supported in safe mode.`)
                return
            }
            if ((await get_tasks()).find(t => t.name == 'Auto')) {
                await cancel_task('Auto')
                console.log('Disabled auto resceduling.')
            } else console.log('Auto rescheduling not enabled. Enable with option "auto".')
            return
        }
        case 'auto': {
            if (safemode) {
                console.log(`'auto' not supported in safe mode.`)
                return
            }
            if (!(await get_tasks()).find(t => t.name == 'Auto')) {
                await create_schedule_task()
                console.log('Enabled auto rescheduling.')
            } else console.log('Auto rescheduling already enabled. Disable with "noauto" option.')
        }
        case 'update':
        case '':
        case undefined: {
            if (safemode) console.log('Running in safe mode. Terminal must remain open.')
            console.log('Logging in...')
            const id = await login(username, password)
            console.log('Fetching schema...')
            const schema = await get_schema(id)
            console.log(`Scheduling...`)
            const now = Date.now()
            const date = new Date().getDate()
            let scheduled = 0, skipped = 0
            let schedule_for = schema.filter(s => s.date == date && s.startTime + retro_delay * 60000 > now)
            if (safemode) {
                for (let s of schedule_for) {
                    setTimeout(async () => {
                        try {
                            console.log('Logging in...')
                            const id = await login(username, password)
                            console.log(`Posting absense note... (${s.team}, ${s.teacher_alias}, ${s.start})`)
                            await post_absense_note(id, s)
                            console.log(`Note posted.`)
                        } catch (e) {
                            console.log('An error occurred:', err)
                        }
                    }, s.startTime + delay * 60000 - now)
                    scheduled++
                }
            } else {
                const already_scheduled = (await get_tasks()).map(t => t.name)
                for (let s of schedule_for) {
                    if (already_scheduled.includes(s.absid)) {
                        skipped++
                        continue
                    }
                    await create_post_task(
                        s,
                        s.startTime + delay * 60000
                    )
                    scheduled++
                }
                const cleaned = await clean_tasks()
                console.log(`Cleaned ${cleaned} task${(cleaned - 1) ? 's' : ''}.`)
            }
            if (skipped) console.log(`Skipped rescheduling ${skipped} note${(skipped - 1) ? 's' : ''}.`)
            console.log(`Scheduled ${scheduled} absense note${(scheduled - 1) ? 's' : ''}.`)
            return
        }
        default:
            console.log(
                `${argv[2] == 'help' ? '' : `Unknown option '${argv[2]}'. `}Available options:\n` +
                ` - update   (schedule all notes today manually, also default option)\n` +
                ` - auto     (enables daily auto scheduling notes)\n` +
                ` - noauto   (disables above)\n` +
                ` - cancel   (cancels remaining notes today)\n` +
                ` - help     (show this menu)\n` +
                ` - post     (internal)\n` +
                `Common usage: node ${argv[1]} auto`
            )
    }
})().catch(err => {
    console.log('An error occurred:', err)
    setInterval(() => { }, 1000)
})

async function login(user, pass) {
    const validationData = await fetch('https://www.lectio.dk/lectio/557/login.aspx')
    const validation = cheerio.load(await validationData.text())('#__EVENTVALIDATION')[0].attribs.value
    const body = new FormData()
    body.append('__EVENTARGUMENT', '')
    body.append('__EVENTTARGET', 'm$Content$submitbtn2')
    body.append('__EVENTVALIDATION', validation)
    body.append('m$Content$username2', user)
    body.append('m$Content$passwordHidden', pass)
    await fetch('https://www.lectio.dk/lectio/557/login.aspx')
    const data = await fetch('https://www.lectio.dk/lectio/557/login.aspx', {
        method: 'POST',
        body
    })
    const bodyText = await data.text()
    const $ = cheerio.load(bodyText)
    const title = $('title').contents()[0].data
    if (title.match(/\beleven\b/i) == null) throw new Error('Login failed')
    return /elevid=(\d+)/.exec(bodyText)[1]
}

/**
 * @returns {Promise<SchemaBrick[]>}
*/
async function get_schema(id) {
    const data = await fetch(`https://www.lectio.dk/lectio/557/SkemaNy.aspx?type=elev&elevid=${id}`)
    const $ = cheerio.load(await data.text())
    const title = $('title').contents()[0].data
    if (title.match(/\beleven\b/i) == null) throw new Error('Schema fetch failed')
    const bricks = $('.s2skemabrik.lec-context-menu-instance')
    return bricks.toArray().map(e => {
        const data = e.attribs['data-additionalinfo']
        if (!data) return null
        if (/lektiecaf(?:e|é)/i.test(data)) return null
        const time = /(\d+)\/(\d+)-(\d+) (\S+) \S+ (\S+)/.exec(data)
        const startTime = new Date(`${time[2]} ${time[1]} ${time[3]} ${time[4]}`).valueOf()
        return {
            startTime,
            date: parseInt(time[1], 10),
            month: parseInt(time[2], 10),
            year: parseInt(time[3], 10),
            start: time[4],
            end: time[5],
            absid: /absid=(\d+)/.exec(e.attribs.href)[1],
            team: (/Hold: (.*)/.exec(data) || [, '?'])[1].trim(),
            teacher: (/Lærer: ([^(]*)/.exec(data) || [, '?'])[1].trim(),
            teacher_alias: (/Lærer: [^(]*\((\w+)/.exec(data) || [, '?'])[1]
        }
    }).filter(x => x)
}
/**
 * @param {string} id 
 * @param {SchemaBrick} s 
 */
async function post_absense_note(id,s) {
    const validationData = await fetch(`https://www.lectio.dk/lectio/557/aktivitet/aktivitetforside2.aspx?absid=${s.absid}&elevid=${id}&lectab=elevindhold`)
    const valData = cheerio.load(await validationData.text())
    const validation = valData('#__EVENTVALIDATION')[0].attribs.value
    const ykey = valData('#__VIEWSTATEY_KEY')[0].attribs.value
    const body = new FormData()
    const post_notes = notes[s.teacher_alias] || notes._
    let note = post_notes[Math.floor(Math.random() * post_notes.length)]
    while (note == '' || typeof note == 'function') {
        if (note == '')
            note = notes._[Math.floor(Math.random() * notes._.length)]
        if (typeof note == 'function')
            note = note(s)
    }
    body.append('__EVENTARGUMENT', 'save')
    body.append('__EVENTTARGET', 's$m$Content$Content$Elevindhold$tocAndToolbar$elevindholdEditLV$ctrl1$HomeworkEditLV$ctrl0$editor')
    body.append('__EVENTVALIDATION', validation)
    body.append('s$m$Content$Content$Elevindhold$tocAndToolbar$elevindholdEditLV$ctrl1$HomeworkEditLV$ctrl0$editor$ca', '')
    body.append('s$m$Content$Content$Elevindhold$tocAndToolbar$elevindholdEditLV$ctrl1$HomeworkEditLV$ctrl0$editor$editorBookmarkField', '%5B%7B%22start%22%3A%5B2%2C7%2C3%2C37%2C5%2C5%2C3%2C3%2C3%2C7%2C3%2C1%2C1%2C1%2C3%2C1%2C1%2C2%2C1%2C0%2C0%2C0%2C0%2C0%5D%2C%22end%22%3Anull%2C%22startOffset%22%3A3%2C%22endOffset%22%3A3%2C%22normalized%22%3Atrue%2C%22collapsed%22%3Atrue%2C%22is2%22%3Atrue%7D%5D')
    body.append('s$m$Content$Content$Elevindhold$tocAndToolbar$elevindholdEditLV$ctrl1$HomeworkEditLV$ctrl0$editor$isDirty', 1)
    body.append('s$m$Content$Content$Elevindhold$tocAndToolbar$hiddenFieldTocToggleStatus', '')
    body.append('s$m$searchinputfield', '')
    body.append('__VIEWSTATEY_KEY', ykey)
    body.append('s$m$Content$Content$Elevindhold$tocAndToolbar$elevindholdEditLV$ctrl1$HomeworkEditLV$ctrl0$editor$ed',
        `<h1 id="321">${note}</h1>`
    )
    const data = await fetch(`https://www.lectio.dk/lectio/557/aktivitet/aktivitetforside2.aspx?absid=${s.absid}&elevid=${id}&lectab=elevindhold`, {
        method: 'POST',
        body
    })
    const $ = cheerio.load(await data.text())
    const title = $('title').contents()[0].data
    if (title.match(/\beleven\b/i) == null) throw new Error('Post absense note failed')
}

/** @returns {Promise<{name:string,hasRun:boolean}[]>} */
async function get_tasks() {
    const res = await exec(`schtasks /query /fo csv`)
    return res
        .split('\n')
        .filter(v => v.startsWith('"\\NodeTasks'))
        .map(v => '[' + v + ']')
        .map(v => JSON.parse(v.replace(/\\/g, '\\\\')))
        .map(v => ({ name: v[0].slice(11), hasRun: v[1] == 'N/A' }))
}

async function cancel_task(name) {
    await exec(`schtasks /delete /tn "NodeTasks\\${name}" /f`)
}

async function cancel_all() {
    let i = 0
    for (let task of await get_tasks()) {
        if (Number.isNaN(Number(task.name))) continue
        await cancel_task(task.name)
        if (!task.hasRun) i++
    }
    return i
}

async function clean_tasks() {
    let i = 0
    for (let task of await get_tasks()) {
        if (!task.hasRun) continue
        await cancel_task(task.name)
        i++
    }
    return i
}

/**
 * @param {SchemaBrick} s 
 * @param {number} time 
 */
async function create_post_task(s, time) {
    const date = new Date(time)
    await exec(`schtasks /create /sc once /tn "NodeTasks\\${s.absid.toString().replace(/"/g, '\\"')}" /sd ${
        date.getDate().toString().padStart(2, '0')
        }/${
        (date.getMonth() + 1).toString().padStart(2, '0')
        }/${
        date.getFullYear()
        } /st ${
        date.getHours().toString().padStart(2, '0')
        }:${
        date.getMinutes().toString().padStart(2, '0')
        } /tr "'${process.argv0}' '${process.argv[1]}' keepopen post '${s.absid}'"`)
}

async function create_schedule_task() {
    await exec(`schtasks /create /sc daily /st 08:10 /tn "NodeTasks\\Auto" /tr "'${process.argv0}' '${process.argv[1]}' keepopen"`)
}

function exec(...args) {
    return new Promise((resolve, reject) => {
        child_process.exec(...args, (err, res) => {
            if (err) reject(err)
            else resolve(res)
        })
    })
}
