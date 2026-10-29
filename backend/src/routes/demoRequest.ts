import { Router, Request, Response } from 'express';

const router = Router();

export interface DemoBookingPayload {
  schoolName: string;
  contactPerson: string;
  email: string;
  phone: string;
  institutionType?: string;
  preferredDate?: string;
  message?: string;
}

// In-memory record store for local testing and backup logging
const demoBookings: Array<DemoBookingPayload & { id: string; receivedAt: string; ip?: string }> = [];

router.post('/', async (req: Request, res: Response) => {
  try {
    const { schoolName, contactPerson, email, phone, institutionType, preferredDate, message } = req.body || {};

    if (!schoolName || typeof schoolName !== 'string' || !schoolName.trim()) {
      return res.status(400).json({ success: false, message: 'School name is required.' });
    }
    if (!contactPerson || typeof contactPerson !== 'string' || !contactPerson.trim()) {
      return res.status(400).json({ success: false, message: 'Contact person name is required.' });
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'A valid work email address is required.' });
    }
    if (!phone || typeof phone !== 'string' || phone.trim().length < 7) {
      return res.status(400).json({ success: false, message: 'A valid phone number is required.' });
    }

    const bookingId = `DEMO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const newRecord = {
      id: bookingId,
      schoolName: schoolName.trim(),
      contactPerson: contactPerson.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      institutionType: institutionType?.trim() || 'K-12 School',
      preferredDate: preferredDate?.trim() || new Date(Date.now() + 86400000).toISOString().split('T')[0],
      message: message?.trim() || '',
      receivedAt: new Date().toISOString(),
      ip: req.ip || req.socket.remoteAddress
    };

    demoBookings.unshift(newRecord);

    console.log(`[AttendoSchool Demo Request] Registered demo inquiry for ${newRecord.schoolName} (${newRecord.contactPerson}) - ID: ${bookingId}`);

    return res.status(201).json({
      success: true,
      bookingId,
      message: 'Thank you! Your demo request has been received. Our education specialist will contact you shortly.',
      details: {
        schoolName: newRecord.schoolName,
        contactPerson: newRecord.contactPerson,
        preferredDate: newRecord.preferredDate
      }
    });
  } catch (error: any) {
    console.error('Error handling demo booking request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit demo request. Please contact support@attendoschool.online directly.'
    });
  }
});

// GET endpoint to verify submitted bookings (helpful for inspection)
router.get('/', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    count: demoBookings.length,
    bookings: demoBookings.slice(0, 25)
  });
});

export default router;
