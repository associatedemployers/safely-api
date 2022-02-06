You would have a key on hub registration that would be linked to the time class time block.

# matching by registrant <-

# 1 x 20 parts hubregistration <- unwind -> 1 x 1 part registration < match our participant >
# 1 x 1 part registration

1. Class calendar Easy, nice, fast call (class registrations) (global, cacheable)
2. Availability calendar API shitshow (regular registrations) (global, cacheable)
3. Registration context: (a mesh of both registration types) (specific context by registrant/participant, optimize this)

```
const registrations = await db.collection('registrations').find({
  trainee: { $in: traineeIds }
  // lookback times as well
});

const hubRegistrations = await db.collection('hubRegistrations').aggregate([{
  $match: {
    // lookback times as well
    participants: { $in: traineeIds.map(x => ObjectId(x)) },
  } // get me all the hubRegistrations with the participants I want
}, {
  $unwind: '$participants'
}, { // unwind, some participants aren't what I want
  $match: {
    participants: { $in: traineeIds.map(x => ObjectId(x)) }
  } // filter out unwanted participants
}, {
  $project: {
    start:
    end:
    participant:
    hubClass: 123
  }
}]);

return [ ...registrations, ...hubRegistrations ];
/*
This ^ looks like:
*/
const context = [{
  start: 1/1/20 3:00pm end trainee: 123 hubClass?
}, {
  start: 1/1/20 3:00pm end trainee: 1234
}]

// In the context of server side validation /post save, pre save, whatever
// If you pass in an actual time you are checking vs a lookback you're turning it from a 
// Potential scheduling conflicts method to a actual scheduling conflicts method.
```
I hover over a hub class to register abc for hubclass 1.

```
const whoIsAlreadyBookedForThisTime = context.filter(item => {
  return moment(item.start).isSame(registrationTimeIHovered.start) && participantsToRegister.find(x => x._id === item.trainee);
})

Trainee ABC is booked for "Tossing potatoes, a class taught by jerms" at 1/1 3PM. Registering this time will prompt you to select another time for this trainee.
```

I look at the registration context (loading spinner), if I have at least one registrant that is matching a registration context, I show a tooltip: Can't book ABC, already booked for 3pm on Some class

Hub class:
How many seats left (1.)
Can I book these people (3.)

Regular registration:
Can I book a regisration (2/3)
