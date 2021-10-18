/*

 _____       _                _              _
/  __ \     | |              | |            | |
| /  \/ __ _| | ___ _ __   __| | __ _ _ __  | |     _____   _____
| |    / _` | |/ _ \ '_ \ / _` |/ _` | '__| | |    / _ \ \ / / _ \
| \__/\ (_| | |  __/ | | | (_| | (_| | |    | |___| (_) \ V /  __/
 \____/\__,_|_|\___|_| |_|\__,_|\__,_|_|    \_____/\___/ \_/ \___|


Copyright 2021 Kerry Ivan Kurian

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/* 

Got muliple Google calendar accounts? Wish they would they all show your
actual availability regardless of which account has a scheduled event?

Here's some calendar love for you:

This Google Apps script looks at calendars in your other Google accounts and
puts blocks in your current account's calendar where your other accounts have
events. 

Additionally, this script removes blocks from your current account's calendar
when your other calendars no longer have events.

Now your current calendar always shows your availability, taking into account
all of the events in your other calendars.

If you share all of your Google accounts' calendars with each other, then you
can install this script in all of your Google accounts and they will all stay
in sync.

*/

/* 
   Share your other calendars with your current account then add your other
   calendars' ids here.
 
   You know the other calendars are properly shared with your current account
   when you can see them at calendar.google.com while logged into your
   current acount.
*/
const REMOTE_CALENDAR_IDS = [
    "your_account@some_gsuite_domain.com",
    "your_account@gmail.com"
];

/* When we put a block in a calendar, this is what we will call the event. */
const BLOCKED_EVENT_TITLE = "blocked";

/*
  N.B. BLOCKED_EVENT_TITLE is a magic value. This script assumes that it can
  add *and remove* events with this name. You should not manually add events
  with this name to your current account's calendar, ever. This script may
  remove them.
*/

/* This is how far ahead we look when doing our work. */
const LOOKAHEAD_DAYS = 30;


////
// YOU SHOULD NOT HAVE TO CHANGE ANYTHING BELOW THIS LINE.
////

const MILLISECS_PER_DAY = 24 * 60 * 60 * 1000;

const START_DATE = new Date();
const END_DATE = new Date(START_DATE.getTime() + (LOOKAHEAD_DAYS * MILLISECS_PER_DAY))


function updateBlocks() {
    blockRemoteEventsInLocalCalendar();
    removeObsoleteBlocksFromLocalCalendar();
}

function blockRemoteEventsInLocalCalendar() {
    const remoteCalendars = REMOTE_CALENDAR_IDS.map(id => CalendarApp.getCalendarById(id));
    for (const remoteCalendar of remoteCalendars) {
        createBlocksInLocalCalendarFrom(remoteCalendar);
    }
};

function removeObsoleteBlocksFromLocalCalendar() {
    for (const obsoleteBlock of getObsoleteBlocks()) {
        obsoleteBlock.deleteEvent();
    }
}

function getObsoleteBlocks() {
    const localCalendar = CalendarApp.getDefaultCalendar();
    const localBlocks = localCalendar.getEvents(START_DATE, END_DATE).filter(event => event.getTitle() == BLOCKED_EVENT_TITLE);

    const remoteCalendars = REMOTE_CALENDAR_IDS.map(id => CalendarApp.getCalendarById(id));
    const remoteEvents = remoteCalendars.map(
        remoteCalendar => remoteCalendar.getEvents(START_DATE, END_DATE)
    ).flat().filter(event => event.getTitle() != BLOCKED_EVENT_TITLE);

    let result = [];

    for (const localBlock of localBlocks) {
        if (isLocalBlockObsolete(localBlock, remoteEvents)) {
            result.push(localBlock);
        }
    }

    return result;
}

function isLocalBlockObsolete(localBlock, remoteEvents) {
    const localBlockStartTime = localBlock.getStartTime().getTime();
    const localBlockEndTime = localBlock.getEndTime().getTime();
    
    for (const remoteEvent of remoteEvents) {
        if (remoteEvent.getStartTime().getTime() == localBlockStartTime &&
            remoteEvent.getEndTime().getTime() == localBlockEndTime
        ) {
            return false;
        }
    }
    return true;
}

function createBlocksInLocalCalendarFrom(remoteCalendar) {
    const localCalendar = CalendarApp.getDefaultCalendar();
    const localEvents = localCalendar.getEvents(START_DATE, END_DATE);

    const remoteEvents = remoteCalendar.getEvents(START_DATE, END_DATE).filter(
        event => event.getTitle() != BLOCKED_EVENT_TITLE);

    for (const remoteEvent of remoteEvents) {
        if (!remoteEvent.isAllDayEvent() && !localBlockExistsFor(remoteEvent, localEvents)) {
            createLocalBlockFor(remoteEvent, localCalendar);
        }
    }
}

function localBlockExistsFor(remoteEvent, localEvents) {
    const remoteEventStartTime = remoteEvent.getStartTime().getTime();
    const remoteEventEndTime = remoteEvent.getEndTime().getTime();

    for (const localEvent of localEvents) {
        if (localEvent.getTitle() == BLOCKED_EVENT_TITLE &&
            localEvent.getStartTime().getTime() == remoteEventStartTime &&
            localEvent.getEndTime().getTime() == remoteEventEndTime
        ) {
            return true;
        }
    }
    return false;
}

function createLocalBlockFor(remoteEvent, localCalendar) {
    let localBlock = localCalendar.createEvent(
        BLOCKED_EVENT_TITLE,
        remoteEvent.getStartTime(),
        remoteEvent.getEndTime());
    localBlock.removeAllReminders();
}
