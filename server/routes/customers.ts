import { Router, Response } from 'express';
import { db, WILAYAS_DZ } from '../db.js';
import { AuthenticatedRequest, authMiddleware, apiError } from '../middleware/auth.js';
import { Customer, CustomerStatus } from '../../src/types/dzpos.js';

const router = Router();

// GET /api/customers - List customers with filtering and search
router.get('/', authMiddleware(['MAIN_ADMIN', 'ADMIN', 'SUPPORT']), (req: AuthenticatedRequest, res: Response) => {
  const { status, activity_code, wilaya_code, search, page = '1', limit = '50' } = req.query;

  let customers = [...db.getCustomers()];

  if (status && typeof status === 'string') {
    customers = customers.filter(c => c.status === status);
  }
  if (activity_code && typeof activity_code === 'string') {
    customers = customers.filter(c => c.activity_code === activity_code);
  }
  if (wilaya_code && typeof wilaya_code === 'string') {
    customers = customers.filter(c => c.wilaya_code === wilaya_code);
  }
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    customers = customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.business_name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  }

  // Enrich with active license key and device count
  const enriched = customers.map(c => {
    const custLicenses = db.getLicenses().filter(l => l.customer_id === c.id);
    const activeLic = custLicenses.find(l => l.status === 'active');
    const totalDevices = custLicenses.reduce((acc, l) => acc + (l.devices?.filter(d => d.status === 'active').length || 0), 0);
    return {
      ...c,
      active_license_key: activeLic?.license_key || c.active_license_key,
      device_count: totalDevices,
      licenses_count: custLicenses.length
    };
  });

  const p = parseInt(page as string, 10) || 1;
  const l = parseInt(limit as string, 10) || 50;
  const total = enriched.length;
  const paginated = enriched.slice((p - 1) * l, p * l);

  res.json({
    success: true,
    data: paginated,
    pagination: {
      page: p,
      limit: l,
      total,
      total_pages: Math.ceil(total / l)
    }
  });
});

// GET /api/customers/wilayas - List 58 Algerian Wilayas
router.get('/wilayas', (req, res) => {
  res.json({
    success: true,
    data: WILAYAS_DZ
  });
});

// GET /api/customers/:id - Customer details with linked licenses & devices
router.get('/:id', authMiddleware(['MAIN_ADMIN', 'ADMIN', 'SUPPORT']), (req: AuthenticatedRequest, res: Response) => {
  const customer = db.getCustomers().find(c => c.id === req.params.id);
  if (!customer) {
    return apiError(res, 404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
  }

  const licenses = db.getLicenses().filter(l => l.customer_id === customer.id);
  const requests = db.getLicenseRequests().filter(r => r.customer_id === customer.id);

  res.json({
    success: true,
    data: {
      customer,
      licenses,
      requests
    }
  });
});

// POST /api/customers - Create new customer
router.post('/', authMiddleware(['MAIN_ADMIN', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { name, phone, email, business_name, activity_code, wilaya_code, city, admin_notes } = req.body;

  if (!name || !phone || !business_name || !activity_code || !wilaya_code) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'Missing required fields: name, phone, business_name, activity_code, wilaya_code');
  }

  const activity = db.getActivities().find(a => a.code === activity_code);
  const wilaya = WILAYAS_DZ.find(w => w.code === wilaya_code);

  const newCustomer: Customer = {
    id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim(),
    phone: phone.trim(),
    email: email ? email.trim() : undefined,
    business_name: business_name.trim(),
    activity_code,
    activity_name: activity ? activity.name_fr : activity_code,
    wilaya_code,
    wilaya_name: wilaya ? wilaya.name : `Wilaya ${wilaya_code}`,
    city: city ? city.trim() : undefined,
    status: 'active',
    admin_notes: admin_notes ? admin_notes.trim() : undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    device_count: 0
  };

  db.getCustomers().unshift(newCustomer);
  db.save();

  db.addAuditLog(
    req.user?.username || 'admin',
    req.user?.role || 'ADMIN',
    'CUSTOMER_CREATED',
    'customers',
    newCustomer.id,
    { name: newCustomer.name, business: newCustomer.business_name, wilaya: newCustomer.wilaya_name },
    req.ip
  );

  res.status(201).json({
    success: true,
    message: 'Customer created successfully',
    data: newCustomer
  });
});

// PUT /api/customers/:id - Update customer
router.put('/:id', authMiddleware(['MAIN_ADMIN', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const customer = db.getCustomers().find(c => c.id === req.params.id);
  if (!customer) {
    return apiError(res, 404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
  }

  const { name, phone, email, business_name, activity_code, wilaya_code, city, admin_notes, status } = req.body;

  if (name) customer.name = name.trim();
  if (phone) customer.phone = phone.trim();
  if (email !== undefined) customer.email = email ? email.trim() : undefined;
  if (business_name) customer.business_name = business_name.trim();
  if (activity_code) {
    const act = db.getActivities().find(a => a.code === activity_code);
    customer.activity_code = activity_code;
    if (act) customer.activity_name = act.name_fr;
  }
  if (wilaya_code) {
    const wilaya = WILAYAS_DZ.find(w => w.code === wilaya_code);
    customer.wilaya_code = wilaya_code;
    if (wilaya) customer.wilaya_name = wilaya.name;
  }
  if (city !== undefined) customer.city = city ? city.trim() : undefined;
  if (admin_notes !== undefined) customer.admin_notes = admin_notes ? admin_notes.trim() : undefined;
  if (status && ['active', 'suspended', 'blocked'].includes(status)) {
    customer.status = status as CustomerStatus;
  }

  customer.updated_at = new Date().toISOString();
  db.save();

  db.addAuditLog(
    req.user?.username || 'admin',
    req.user?.role || 'ADMIN',
    'CUSTOMER_UPDATED',
    'customers',
    customer.id,
    { fields_updated: Object.keys(req.body) },
    req.ip
  );

  res.json({
    success: true,
    message: 'Customer updated successfully',
    data: customer
  });
});

// PATCH /api/customers/:id/status - Change status (active, suspended, blocked)
router.patch('/:id/status', authMiddleware(['MAIN_ADMIN', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const customer = db.getCustomers().find(c => c.id === req.params.id);
  if (!customer) {
    return apiError(res, 404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
  }

  const { status, reason } = req.body;
  if (!status || !['active', 'suspended', 'blocked'].includes(status)) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'Invalid status. Must be active, suspended, or blocked');
  }

  const oldStatus = customer.status;
  customer.status = status as CustomerStatus;
  customer.updated_at = new Date().toISOString();
  if (reason) {
    customer.admin_notes = `${customer.admin_notes || ''}\n[Status Change to ${status} on ${new Date().toLocaleDateString()}]: ${reason}`.trim();
  }

  db.save();

  db.addAuditLog(
    req.user?.username || 'admin',
    req.user?.role || 'ADMIN',
    `CUSTOMER_STATUS_${status.toUpperCase()}`,
    'customers',
    customer.id,
    { oldStatus, newStatus: status, reason },
    req.ip
  );

  res.json({
    success: true,
    message: `Customer status updated to ${status}`,
    data: customer
  });
});

export default router;
