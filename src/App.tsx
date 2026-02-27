import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ChatBot from "@/components/chat/ChatBot";
import AdminRoute from "@/components/auth/AdminRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Policies from "./pages/Policies";
import PolicyDetail from "./pages/PolicyDetail";
import Groups from "./pages/Groups";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import UploadPolicyDocs from "./pages/UploadPolicyDocs";
import PendingAttestations from "./pages/PendingAttestations";
import PopulateTestData from "./pages/PopulateTestData";
import CleanupUsers from "./pages/CleanupUsers";
import AddUsersToGroup from "./pages/AddUsersToGroup";
import GroupDetail from "./pages/GroupDetail";
import UploadSamplePolicies from "./pages/UploadSamplePolicies";
import PopulatePolicySamples from "./pages/PopulatePolicySamples";
import Tasks from "./pages/Tasks";
import PPDUBrief from "./pages/PPDUBrief";
import PPDUBriefLibrary from "./pages/PPDUBriefLibrary";
import PPDUBriefDetail from "./pages/PPDUBriefDetail";
import ProjectIntakeForm from "./pages/ProjectIntakeForm";
import ProjectLibrary from "./pages/ProjectLibrary";
import ProjectDetail from "./pages/ProjectDetail";
import MeetTheTeam from "./pages/MeetTheTeam";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ChatBot />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/policies" element={<Policies />} />
          <Route path="/dashboard/policies/:id" element={<PolicyDetail />} />
          <Route path="/dashboard/attestations" element={<PendingAttestations />} />
          <Route path="/dashboard/groups" element={<Groups />} />
          <Route path="/dashboard/groups/:id" element={<GroupDetail />} />
          <Route path="/dashboard/settings" element={<Settings />} />
          <Route path="/dashboard/tasks" element={<Tasks />} />
          <Route path="/dashboard/ppdu-brief" element={<PPDUBrief />} />
          <Route path="/dashboard/ppdu-brief-library" element={<PPDUBriefLibrary />} />
          <Route path="/dashboard/ppdu-brief-library/:id" element={<PPDUBriefDetail />} />
          <Route path="/dashboard/project-intake" element={<ProjectIntakeForm />} />
          <Route path="/dashboard/project-library" element={<ProjectLibrary />} />
          <Route path="/dashboard/project-library/:id" element={<ProjectDetail />} />
          <Route path="/team" element={<MeetTheTeam />} />

          {/* Admin-only utility routes */}
          <Route path="/upload-docs" element={<AdminRoute><UploadPolicyDocs /></AdminRoute>} />
          <Route path="/populate-test-data" element={<AdminRoute><PopulateTestData /></AdminRoute>} />
          <Route path="/cleanup-users" element={<AdminRoute><CleanupUsers /></AdminRoute>} />
          <Route path="/add-users-to-group" element={<AdminRoute><AddUsersToGroup /></AdminRoute>} />
          <Route path="/upload-sample-policies" element={<AdminRoute><UploadSamplePolicies /></AdminRoute>} />
          <Route path="/populate-policy-samples" element={<AdminRoute><PopulatePolicySamples /></AdminRoute>} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
