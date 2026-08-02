const bcrypt = require('bcryptjs');
const { db, migrate } = require('./db');

migrate();

const insertUser = db.prepare(`
  INSERT INTO users (name, email, password_hash, role)
  VALUES (?, ?, ?, ?)
`);

const insertFacility = db.prepare(`
  INSERT INTO facilities (name, category, description, image, capacity)
  VALUES (?, ?, ?, ?, ?)
`);

const insertEquipment = db.prepare(`
  INSERT INTO equipment (name, category, image, total_quantity, available_quantity)
  VALUES (?, ?, ?, ?, ?)
`);

const insertBooking = db.prepare(`
  INSERT INTO bookings (facility_id, user_id, date, start_time, end_time, purpose, participants, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertLoan = db.prepare(`
  INSERT INTO equipment_loans (equipment_id, user_id, quantity, status, due_at, approved_at, returned_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertComplaint = db.prepare(`
  INSERT INTO complaints (user_id, subject, message, status)
  VALUES (?, ?, ?, ?)
`);

function sqliteNow() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function seed() {
  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (userCount > 0) {
    console.log('Database already has data — skipping seed.');
    return;
  }

  const passwordHash = bcrypt.hashSync('password123', 10);

  db.transaction(() => {
    insertUser.run('Admin User', 'admin@sports.edu', passwordHash, 'admin');
    insertUser.run('Officer User', 'officer@sports.edu', passwordHash, 'officer');
    const studentId = insertUser.run('Student User', 'student@sports.edu', passwordHash, 'student').lastInsertRowid;
    const janeId = insertUser.run('Jane Wanjiru', 'jane.wanjiru@student.sports.edu', passwordHash, 'student').lastInsertRowid;
    const brianId = insertUser.run('Brian Kiptoo', 'brian.kiptoo@student.sports.edu', passwordHash, 'student').lastInsertRowid;
    const aminaId = insertUser.run('Amina Yusuf', 'amina.yusuf@student.sports.edu', passwordHash, 'student').lastInsertRowid;

    // Names match the display text in project/pages/facilities.html and
    // equipment.html exactly (data-facility/data-equipment attributes on the
    // "Book Now"/"Request" buttons), since the booking/loan forms send the
    // facility/equipment by name rather than by id.
    const facilities = [
      ['Football Pitch', 'football', 'Professional outdoor football field.', 'football.jpg', 22],
      ['Basketball Court', 'basketball', 'Modern indoor basketball court.', 'basketball.jpg', 10],
      ['Tennis Court', 'tennis', 'Outdoor tennis training facility.', 'tennis.jpg', 4],
      ['Volleyball Court', 'volleyball', 'Professional volleyball court.', 'volleyball.jpg', 12],
      ['Rugby Field', 'rugby', 'Full-size rugby playing field.', 'rugby.jpg', 30],
      ['Gymnasium', 'gym', 'Fully equipped fitness centre.', 'gym.jpg', 40],
    ];
    const facilityIds = facilities.map(f => insertFacility.run(...f).lastInsertRowid);
    const [pitchId, basketballCourtId, tennisCourtId, volleyballCourtId, , gymId] = facilityIds;

    const equipment = [
      ['Footballs', 'balls', 'football.jpg', 18, 18],
      ['Basketballs', 'balls', 'basketball.jpg', 12, 12],
      ['Rackets', 'rackets', 'tennis.jpg', 3, 3],
      ['Team Jerseys', 'jerseys', 'sports.jpg', 5, 5],
      ['Training Cones', 'cones', 'sports.jpg', 9, 9],
      ['Rugby Balls', 'balls', 'rugby.jpg', 8, 8],
      ['Volleyballs', 'balls', 'volleyball.jpg', 0, 0],
    ];
    const equipmentIds = equipment.map(e => insertEquipment.run(...e).lastInsertRowid);
    const [footballsId, basketballsId, racketsId, jerseysId, conesId] = equipmentIds;

    // Bookings — a mix of statuses across students/facilities so the
    // dashboards have something realistic to show.
    insertBooking.run(basketballCourtId, studentId, '2026-08-05', '15:00', '16:00', 'Practice session', 6, 'pending');
    insertBooking.run(pitchId, studentId, '2026-08-06', '17:00', '18:30', 'Inter-hostel friendly', 16, 'confirmed');
    insertBooking.run(gymId, janeId, '2026-08-03', '07:00', '08:00', 'Morning workout', 4, 'confirmed');
    insertBooking.run(tennisCourtId, brianId, '2026-07-20', '09:00', '10:00', 'Coaching session', 2, 'cancelled');
    insertBooking.run(volleyballCourtId, aminaId, '2026-08-10', '18:00', '19:00', 'Club match', 12, 'pending');

    // Equipment loans — pending / approved / rejected / returned, so the
    // officer's check-out/check-in flow has real rows to act on. When a
    // loan is inserted as already approved/checked_out, available_quantity
    // is decremented to match what the /approve endpoint would have done.
    const now = sqliteNow();

    insertLoan.run(basketballsId, studentId, 2, 'pending', '2026-08-12', null, null);

    insertLoan.run(conesId, studentId, 1, 'approved', '2026-08-09', now, null);
    db.prepare('UPDATE equipment SET available_quantity = available_quantity - 1 WHERE id = ?').run(conesId);

    insertLoan.run(racketsId, janeId, 2, 'approved', '2026-08-08', now, null);
    db.prepare('UPDATE equipment SET available_quantity = available_quantity - 2 WHERE id = ?').run(racketsId);

    const rejectedLoanId = insertLoan.run(jerseysId, brianId, 1, 'rejected', null, null, null).lastInsertRowid;
    db.prepare('UPDATE equipment_loans SET reject_reason = ? WHERE id = ?')
      .run('Insufficient stock for the requested date', rejectedLoanId);

    insertLoan.run(footballsId, aminaId, 3, 'returned', '2026-07-28', now, now);

    insertComplaint.run(aminaId, 'Basketball court lights not working', 'The floodlights on court 1 keep flickering during evening sessions.', 'open');
    insertComplaint.run(brianId, 'Returned jersey not marked as received', 'I returned a jersey set last week but it still shows as on loan.', 'resolved');
  })();

  console.log('Seed complete:');
  console.log('  admin@sports.edu / officer@sports.edu / student@sports.edu — password: password123');
  console.log('  (jane.wanjiru / brian.kiptoo / amina.yusuf @student.sports.edu — same password, extra demo students)');
}

seed();
