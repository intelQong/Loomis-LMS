# AIMS English LMS — Cloudflare Pages Deployment

## Project Structure
```
aims-lms/
├── index.html              ← Login / Signup
├── student-dashboard.html  ← Student portal
├── admin-dashboard.html    ← Admin panel
├── styles/
│   ├── main.css
│   ├── auth.css
│   ├── dashboard.css
│   └── admin.css
└── js/
    ├── firebase-config.js  ← ⚠️ CONFIGURE THIS FIRST
    ├── auth.js
    ├── student-dashboard.js
    └── admin-dashboard.js
```

---

## Step 1: Firebase Setup (Free Spark Plan)

1. Go to https://console.firebase.google.com
2. **Create Project** → Name: `aims-lms` → Continue
3. **Authentication** → Sign-in method → Enable **Email/Password**
4. **Firestore Database** → Create database → Start in **production mode**
5. **Project Settings** → General → Your apps → Add Web App → Copy config
6. Open `js/firebase-config.js` → Replace `FIREBASE_CONFIG` values

### Firestore Security Rules
Go to Firestore → Rules → Paste this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }
    function currentUser() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid));
    }
    function currentRole() {
      return currentUser().data.role;
    }
    function isAdmin() {
      return signedIn() && currentRole() == 'admin';
    }
    function isFaculty() {
      return signedIn() && currentRole() == 'faculty';
    }
    function studentAssignedToFaculty(studentId) {
      return get(/databases/$(database)/documents/users/$(studentId)).data.assignedFacultyId == request.auth.uid;
    }

    match /users/{userId} {
      allow read: if signedIn() && (
        request.auth.uid == userId ||
        isAdmin() ||
        (isFaculty() && resource.data.role == 'student' && resource.data.assignedFacultyId == request.auth.uid)
      );
      allow write: if signedIn() && (
        request.auth.uid == userId ||
        isAdmin()
      );
      match /payments/{payId} {
        allow read: if signedIn() && (
          request.auth.uid == userId ||
          isAdmin() ||
          (isFaculty() && studentAssignedToFaculty(userId))
        );
        allow write: if signedIn() && isAdmin();
      }
    }

    match /notifications/{notifId} {
      allow read: if signedIn() && (
        resource.data.targetType == 'all' ||
        resource.data.targetUserId == request.auth.uid ||
        (resource.data.targetType == 'assigned' && resource.data.targetFacultyId == currentUser().data.assignedFacultyId) ||
        isAdmin() ||
        (isFaculty() && resource.data.sentBy == request.auth.uid)
      );
      allow create: if signedIn() && (
        isAdmin() ||
        (isFaculty() && request.resource.data.sentBy == request.auth.uid && (
          (request.resource.data.targetType == 'assigned' && request.resource.data.targetFacultyId == request.auth.uid) ||
          (request.resource.data.targetType == 'individual' && studentAssignedToFaculty(request.resource.data.targetUserId))
        ))
      );
      allow delete: if signedIn() && (
        isAdmin() ||
        (isFaculty() && resource.data.sentBy == request.auth.uid)
      );
    }
  }
}
```

---

## Step 2: Create First Admin Account

After deploying:
1. Sign up normally on the LMS
2. Go to Firebase Console → Firestore → users → find your document
3. Change `role` from `student` to `admin`
4. Change `status` from `pending` to `active`
5. Now log in — you'll be redirected to admin dashboard


---

## Step 3: Create Faculty Accounts and Assign Students

Faculty accounts use the same login page as admins and students. After a faculty member signs up:

1. Go to Firebase Console → Firestore → `users` → find the faculty user's document.
2. Change `role` from `student` to `faculty`.
3. Change `status` to `active`.
4. Copy the faculty user's document ID (UID).
5. Assign students by opening the admin dashboard → Students → Edit → paste that UID into **Assigned Faculty UID**.

Faculty members are redirected to the faculty view of the admin dashboard. They can see assigned students and send notifications to either all assigned students or one assigned student.

---

## Step 4: Deploy to Cloudflare Pages

### Option A: GitHub + Cloudflare Pages (Recommended)

1. Push this folder to a GitHub repo
2. Go to https://dash.cloudflare.com → Pages → Create a project
3. Connect GitHub → Select repo
4. Build settings:
   - **Framework preset**: None
   - **Build command**: (leave empty)
   - **Build output directory**: `/` (or `.`)
5. Click **Save and Deploy**
6. Go to **Custom domains** → Add `student.aimsctg.online`
7. Update DNS: CNAME `student` → `your-project.pages.dev`

### Option B: Direct Upload (No GitHub needed)

1. Zip the `aims-lms` folder
2. Cloudflare Pages → Create project → **Direct upload**
3. Upload the zip
4. Set custom domain: `student.aimsctg.online`

---

## Step 5: Firebase Auth Domain

Add your domain to Firebase:
1. Firebase Console → Authentication → Settings → Authorized domains
2. Add: `student.aimsctg.online`
3. Add: `your-project.pages.dev`

---

## Costs

| Service | Cost |
|---|---|
| Cloudflare Pages | Free (unlimited requests) |
| Firebase Auth | Free (up to 10k/month) |
| Firestore | Free (1GB storage, 50k reads/day) |
| Custom domain | You already own it |

**Total: ৳0/month** 🎉

---

## Admin Quick Reference

| Action | Where |
|---|---|
| Approve student | Students tab → Approve button |
| Update payment | Payments tab → Update Payment |
| Send mass notification | Notifications tab → Send Notification → All Students |
| Send to one student | Notifications → Individual → Select student |
| Assign faculty to student | Students tab → Edit → Assigned Faculty UID |
| Faculty notification | Faculty dashboard → Notifications → All Assigned Students or Assigned Individual Student |
| Suspend student | Students tab → Suspend |
| Edit student details | Students tab → Edit |
