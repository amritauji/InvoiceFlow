import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const SubmitInvoice = lazy(() => import('./pages/SubmitInvoice'));
const ReviewInvoice = lazy(() => import('./pages/ReviewInvoice'));
const PrintApproval = lazy(() => import('./pages/PrintApproval'));
const ApprovalQueue = lazy(() => import('./pages/ApprovalQueue'));
const MySubmissions = lazy(() => import('./pages/MySubmissions'));
const AuditTrail = lazy(() => import('./pages/AuditTrail'));
const AdminManagement = lazy(() => import('./pages/AdminManagement'));
const SearchResults = lazy(() => import('./pages/SearchResults'));
const SubmitStatement = lazy(() => import('./pages/SubmitStatement'));
const MyStatements = lazy(() => import('./pages/MyStatements'));
const StatementDetail = lazy(() => import('./pages/StatementDetail'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
      <div className="flex items-center gap-3 text-gray-400 dark:text-[#8d95b0]">
        <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
        <span className="text-sm">Loading...</span>
      </div>
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="invoices/new" element={<ProtectedRoute allowedRoles={['admin','department_user','accountant_1','accountant_2']}><SubmitInvoice /></ProtectedRoute>} />
          <Route path="invoices/:id" element={<ReviewInvoice />} />
          <Route path="invoices/:id/print" element={<ProtectedRoute allowedRoles={['admin','accountant_1']}><PrintApproval /></ProtectedRoute>} />
          <Route path="approvals" element={<ApprovalQueue />} />
          <Route path="search" element={<SearchResults />} />
          <Route path="invoices" element={<MySubmissions />} />
          <Route path="audit" element={<ProtectedRoute allowedRoles={['admin','accountant_1','accountant_2','manager','ceo']}><AuditTrail /></ProtectedRoute>} />
          <Route path="admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminManagement /></ProtectedRoute>} />
          <Route path="statements" element={<MyStatements />} />
          <Route path="statements/new" element={<ProtectedRoute allowedRoles={['accountant_1']}><SubmitStatement /></ProtectedRoute>} />
          <Route path="statements/:id" element={<StatementDetail />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
