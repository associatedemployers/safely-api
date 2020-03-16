const ics = require('ics'),
      moment = require('moment');

module.exports = async function () {
  const HubClassInformation = require('../../hub-class-information'),
        HubInstructor = require('../../hub-instructor'),
        { times, location: { geo, name, address: { line1, line2, city, state } } } = this;

  const classInformation = this.classInformation._id ? this.classInformation : await HubClassInformation.findById(this.classInformation),
        instructor = this.instructor._id ? this.instructor : await HubInstructor.findById(this.instructor),
        [ lat, lon ] = (geo || {}).coordinates || [];

  const baseEvent = {
    title: classInformation.name,
    description: classInformation.description,
    location: `${name} (${line1} ${line2 ? line2 + ' ' : ''}${city}, ${state})`,
    url: 'https://associatedemployers.org',
    geo: {
      lat,
      lon
    },
    organizer: {
      name: instructor.displayName,
      email: instructor.email
    },
    status: 'CONFIRMED',
    busyStatus: 'BUSY'
  };

  if (times.length === 1) {
    const ev = ics.createEvent({
      ...baseEvent,
      start: moment(times[0].start).format('YYYY-M-D-H-m').split('-'),
      end: moment(times[0].end).format('YYYY-M-D-H-m').split('-')
    });
    console.log(ev);

    return ev.value;
  }

  const ev = ics.createEvents(times.map(({ start, end }, i) => ({
    ...baseEvent,
    title: `${baseEvent.title} (${i + 1}/${times.length})`,
    start: moment(start).format('YYYY-M-D-H-m').split('-'),
    end: moment(end).format('YYYY-M-D-H-m').split('-')
  })));
  console.log(ev);
  return ev.value;
};
