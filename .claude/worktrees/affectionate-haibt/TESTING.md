# 🧪 GymMate Testing Guide

## Manual Testing Checklist

### 1. Authentication Testing

#### Gym Owner Registration:
- [ ] Register with valid details
- [ ] Try registering with existing email (should fail)
- [ ] Try registering with existing phone (should fail)
- [ ] Verify referral code field is optional
- [ ] Enter valid referral code (should apply discount)
- [ ] Verify 3-day trial is set
- [ ] Check JWT token is created
- [ ] Verify gym QR code is generated

#### Member Login:
- [ ] Login with valid credentials
- [ ] Try login with wrong password (should fail)
- [ ] Try login with non-existent email (should fail)
- [ ] Verify redirection to member dashboard

#### Owner Login:
- [ ] Login with valid credentials
- [ ] Verify redirection to owner dashboard
- [ ] Check subscription status display

### 2. Owner Dashboard Testing

#### Overview Tab:
- [ ] Verify stats display correctly:
  - Total members count
  - Active members count
  - Today's attendance
  - Monthly revenue
- [ ] Check expiring members alert shows
- [ ] Check inactive members alert shows
- [ ] Verify referral code displays
- [ ] Check earnings tracker works

#### Members Tab:
- [ ] Add new member with all details
- [ ] Verify member appears in list
- [ ] Click member card to view details
- [ ] Update member information
- [ ] Renew membership
- [ ] Record payment
- [ ] Check payment appears in history
- [ ] Delete/deactivate member
- [ ] Verify member status changes

#### Visitors Tab:
- [ ] Add visitor with contact info
- [ ] Mark as interested in membership
- [ ] Convert visitor to member
- [ ] Delete visitor record
- [ ] View visitor list

#### Notices Tab:
- [ ] Create new notice
- [ ] Set priority (Low/Medium/High)
- [ ] Set expiry date
- [ ] Edit existing notice
- [ ] Delete notice
- [ ] Verify only active notices show

#### QR Code Tab:
- [ ] Verify QR code displays
- [ ] Download QR code image
- [ ] Scan downloaded QR with phone
- [ ] Verify QR contains correct gym info

### 3. Member Dashboard Testing

#### Home Tab:
- [ ] Verify membership status shows
- [ ] Check days until expiry calculation
- [ ] Verify attendance stats display
- [ ] Check recent notices appear
- [ ] Verify referral code shows

#### Scan QR Tab:
- [ ] Allow camera permissions
- [ ] Scan gym QR code
- [ ] Verify success animation plays
- [ ] Check confetti effect
- [ ] Verify check-in recorded
- [ ] Try scanning again (should show already checked in)
- [ ] Click check-out
- [ ] Verify session duration calculated

#### Attendance Tab:
- [ ] View attendance history
- [ ] Check dates are correct
- [ ] Verify check-in/out times
- [ ] Check duration calculation
- [ ] View monthly stats

#### Notices Tab:
- [ ] View all gym notices
- [ ] Check priority badges show
- [ ] Verify newest notices first
- [ ] Read notice content

#### Profile Tab:
- [ ] View personal information
- [ ] Check membership details
- [ ] Verify referral code

### 4. Payment Flow Testing

#### Member Payment:
- [ ] Owner records payment for member
- [ ] Verify membership extended
- [ ] Check payment in history
- [ ] Verify member sees updated expiry

#### Owner Subscription:
- [ ] Make subscription payment
- [ ] Apply referral discount
- [ ] Verify subscription extended
- [ ] Check payment recorded

### 5. Referral System Testing

#### Owner Referral:
- [ ] Share referral code
- [ ] New owner registers with code
- [ ] Verify ₹200 discount applied
- [ ] Check referrer gets ₹200 credited
- [ ] Verify earnings updated

#### Member Referral:
- [ ] Member shares code
- [ ] Track referral usage

### 6. Automation Testing

#### Membership Expiry:
- [ ] Create member with expiry tomorrow
- [ ] Wait for cron job (or trigger manually)
- [ ] Verify notification sent
- [ ] After 3 days grace, check auto-expiry

#### Inactive Members:
- [ ] Member doesn't attend for 3 days
- [ ] Check appears in inactive list
- [ ] Verify owner gets notification

#### Subscription Expiry:
- [ ] Owner subscription expires
- [ ] Check grace period
- [ ] Verify auto-expiry after 3 days

### 7. Edge Cases Testing

#### Boundary Conditions:
- [ ] Register with minimum valid data
- [ ] Test with maximum character lengths
- [ ] Create membership ending today
- [ ] Test with 0 days remaining
- [ ] Test with negative date (should fail)

#### Error Handling:
- [ ] Lose internet during operation
- [ ] Invalid QR code scan
- [ ] Expired token
- [ ] Database connection lost
- [ ] Large file upload (if applicable)

#### Concurrent Operations:
- [ ] Multiple check-ins at same time
- [ ] Two owners with same email
- [ ] Simultaneous payment records

### 8. UI/UX Testing

#### Responsive Design:
- [ ] Test on desktop (1920x1080)
- [ ] Test on laptop (1366x768)
- [ ] Test on tablet (768x1024)
- [ ] Test on mobile (375x667)
- [ ] Test on small mobile (320x568)

#### Browser Compatibility:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile browsers

#### Accessibility:
- [ ] Keyboard navigation
- [ ] Screen reader compatibility
- [ ] Color contrast
- [ ] Font sizes
- [ ] Touch targets (mobile)

### 9. Performance Testing

#### Load Time:
- [ ] Initial page load < 3 seconds
- [ ] Dashboard loads < 2 seconds
- [ ] API responses < 500ms
- [ ] QR scan < 1 second

#### Database:
- [ ] Query with 100 members
- [ ] Query with 1000 members
- [ ] Attendance history with 365 days
- [ ] Payment history with 100 records

### 10. Security Testing

#### Authentication:
- [ ] Access dashboard without token (should fail)
- [ ] Use expired token (should fail)
- [ ] Try member accessing owner routes (should fail)
- [ ] SQL injection attempts
- [ ] XSS attempts

#### Data Protection:
- [ ] Passwords not visible in responses
- [ ] JWT tokens secure
- [ ] HTTPS enforced (production)
- [ ] No sensitive data in logs

## Automated Testing (Future)

### Unit Tests:
```bash
# Backend
cd backend
npm test

# Test Cases:
- User model validation
- Payment calculations
- Attendance logic
- Referral system
- Authentication helpers
```

### Integration Tests:
```bash
# API Tests
- POST /api/auth/register/owner
- POST /api/auth/login
- GET /api/members/gym/:ownerId
- POST /api/attendance/checkin
- POST /api/payments
```

### E2E Tests:
```bash
# Using Cypress/Playwright
- Full user registration flow
- Complete attendance flow
- Payment workflow
- Notice creation and viewing
```

## Bug Reporting Template

```markdown
**Bug Title:** Brief description

**Severity:** Critical / High / Medium / Low

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Result:**

**Actual Result:**

**Screenshots:**

**Environment:**
- Browser:
- OS:
- App Version:

**Additional Notes:**
```

## Test Data

### Sample Owner:
```json
{
  "name": "Test Gym Owner",
  "email": "owner@testgym.com",
  "phone": "9876543210",
  "password": "Test@123",
  "gymName": "Test Fitness Center"
}
```

### Sample Member:
```json
{
  "name": "Test Member",
  "email": "member@test.com",
  "phone": "9876543211",
  "password": "Test@123",
  "membershipFee": 1000,
  "membershipDuration": 1
}
```

## Testing Schedule

### Pre-Release:
- Run all manual tests
- Fix critical bugs
- Verify all features work
- Test on multiple devices

### Post-Release:
- Monitor error logs
- User feedback testing
- A/B testing new features
- Performance monitoring

---

**Happy Testing! 🧪**
