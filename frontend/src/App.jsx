import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SubmitInvoice from './pages/SubmitInvoice';
import ReviewInvoice from './pages/ReviewInvoice';
import PrintApproval from './pages/PrintApproval';
import ApprovalQueue from './pages/ApprovalQueue';
import MySubmissions from './pages/MySubmissions';
import AuditTrail from './pages/AuditTrail';
import AdminManagement from './pages/AdminManagement';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="invoices/new" element={<ProtectedRoute allowedRoles={['admin','department_user']}><SubmitInvoice /></ProtectedRoute>} />
        <Route path="invoices/:id" element={<ReviewInvoice />} />
        <Route path="invoices/:id/print" element={<PrintApproval />} />
        <Route path="approvals" element={<ApprovalQueue />} />
        <Route path="invoices" element={<MySubmissions />} />
        <Route path="audit" element={<ProtectedRoute allowedRoles={['admin','accountant_1','accountant_2','manager','ceo']}><AuditTrail /></ProtectedRoute>} />
        <Route path="admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminManagement /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
