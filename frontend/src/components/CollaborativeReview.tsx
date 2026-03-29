import React, { useState, useEffect } from 'react';
import {
  Users,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Calendar,
  Eye,
  Edit3,
  Send,
  Badge,
  BarChart3,
  GitBranch,
  MessageCircle
} from 'lucide-react';
import { useApiRequest } from '../services/hooks';
import { apiClient } from '../services/apiClient';
import { logger } from '../services/logger';
import { z } from 'zod';

interface ReviewAssignment {
  assignment_id: string;
  evidence_id: string;
  reviewer_id: string;
  reviewer_name: string;
  role: string;
  status: string;
  assigned_at: string;
  due_date: string | null;
  completed_at: string | null;
  weight: number;
}

interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    role: string;
  };
  created_at: string;
  comment_type: string;
  mentions: string[];
  resolved_at: string | null;
  replies: Comment[];
}

interface WorkflowProgress {
  workflow_id: string;
  current_step: string;
  completed_steps: string[];
  pending_steps: string[];
  overall_progress: number;
  estimated_completion: string | null;
}

interface UserPresence {
  user_id: string;
  name: string;
  avatar: string | null;
  activity: string;
  last_seen: string;
  cursor_position: Record<string, any> | null;
}

interface ReviewDecision {
  decision: 'accepted' | 'rejected' | 'deferred' | 'pending';
  rationale: string;
  confidence: number;
  tags: string[];
}

const CollaborativeReviewComponent: React.FC<{ evidenceId: string }> = ({ evidenceId }) => {
  const [assignments, setAssignments] = useState<ReviewAssignment[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [workflowProgress, _setWorkflowProgress] = useState<WorkflowProgress | null>(null);
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState('general');
  const [selectedAssignment, setSelectedAssignment] = useState<ReviewAssignment | null>(null);
  const [showDecisionDialog, setShowDecisionDialog] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<ReviewDecision>({
    decision: 'pending',
    rationale: '',
    confidence: 0.8,
    tags: []
  });
  const [showConflictResolution, setShowConflictResolution] = useState(false);
  const [conflictStrategy, setConflictStrategy] = useState('majority_vote');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // API hooks
  const { data: assignmentsData, refetch: refetchAssignments } = useApiRequest<{
    assignments: ReviewAssignment[];
  }>(
    () => apiClient.request(`/review/assignments?evidence_id=${evidenceId}`, z.object({ assignments: z.array(z.any()) }))
  );

  const { data: commentsData, refetch: refetchComments } = useApiRequest<{
    comment_threads: Comment[];
  }>(
    () => apiClient.request(`/review/comments/${evidenceId}`, z.object({ comment_threads: z.array(z.any()) }))
  );

  const { data: presenceData } = useApiRequest<{
    active_users: UserPresence[];
  }>(
    () => apiClient.request(`/review/presence/${evidenceId}`, z.object({ active_users: z.array(z.any()) })),
    [evidenceId]
  );

  useEffect(() => {
    if (assignmentsData?.assignments) {
      setAssignments(assignmentsData.assignments);
    }
  }, [assignmentsData]);

  useEffect(() => {
    if (commentsData?.comment_threads) {
      setComments(commentsData.comment_threads);
    }
  }, [commentsData]);

  useEffect(() => {
    if (presenceData?.active_users) {
      setActiveUsers(presenceData.active_users);
    }
  }, [presenceData]);

  // Update user presence
  useEffect(() => {
    const updatePresence = () => {
      apiClient.request(
        `/review/presence/${evidenceId}`,
        z.object({}),
        { method: 'POST', body: JSON.stringify({ activity: 'reviewing', cursor_position: null }) }
      ).catch(logger.error);
    };

    updatePresence();
    const interval = setInterval(updatePresence, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [evidenceId]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      await apiClient.request(
        '/review/comments',
        z.object({}),
        {
          method: 'POST',
          body: JSON.stringify({
            evidence_id: evidenceId,
            content: newComment,
            comment_type: commentType,
            mentions: []
          })
        }
      );

      setNewComment('');
      refetchComments();
    } catch (error) {
      logger.error('Failed to add comment:', error);
    }
  };

  const handleSubmitDecision = async () => {
    if (!selectedAssignment) return;

    try {
      await apiClient.request(
        '/review/decisions',
        z.object({}),
        {
          method: 'POST',
          body: JSON.stringify({
            assignment_id: selectedAssignment.assignment_id,
            decision: reviewDecision.decision,
            rationale: reviewDecision.rationale,
            confidence: reviewDecision.confidence,
            tags: reviewDecision.tags
          })
        }
      );

      setShowDecisionDialog(false);
      setSelectedAssignment(null);
      refetchAssignments();
    } catch (error) {
      logger.error('Failed to submit decision:', error);
    }
  };

  const handleResolveConflicts = async () => {
    try {
      await apiClient.request(
        '/review/conflicts/resolve',
        z.object({}),
        {
          method: 'POST',
          body: JSON.stringify({
            evidence_id: evidenceId,
            strategy: conflictStrategy,
            notes: 'Automated conflict resolution'
          })
        }
      );

      setShowConflictResolution(false);
      refetchAssignments();
    } catch (error) {
      logger.error('Failed to resolve conflicts:', error);
    }
  };

  const filteredAssignments = assignments.filter(assignment => {
    if (filterStatus === 'all') return true;
    return assignment.status === filterStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'in_progress': return 'text-blue-600 bg-blue-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getDecisionIcon = (decision: string) => {
    switch (decision) {
      case 'accepted': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'rejected': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'deferred': return <Clock className="h-5 w-5 text-yellow-500" />;
      default: return <AlertTriangle className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Collaborative Evidence Review
          </h1>
          <p className="text-gray-600">
            Multi-reviewer workflow with real-time collaboration and conflict resolution
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Main Review Panel */}
          <div className="col-span-8 space-y-6">
            {/* Real-time Presence */}
            {activeUsers.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-500" />
                    Active Reviewers ({activeUsers.length})
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  {activeUsers.map((user) => (
                    <div
                      key={user.user_id}
                      className="flex items-center gap-2 bg-green-50 px-3 py-1 rounded-full"
                    >
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium text-green-700">{user.name}</span>
                      <span className="text-xs text-green-600">({user.activity})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Review Assignments */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Review Assignments ({filteredAssignments.length})
                </h2>
                <div className="flex items-center gap-3">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-1 text-sm"
                  >
                    <option value="all">All Assignments</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                  {assignments.some(a => a.status === 'completed') && (
                    <button
                      onClick={() => setShowConflictResolution(true)}
                      className="flex items-center gap-2 px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
                    >
                      <GitBranch className="h-4 w-4" />
                      Resolve Conflicts
                    </button>
                  )}
                </div>
              </div>
              
              <div className="divide-y">
                {filteredAssignments.map((assignment) => (
                  <div
                    key={assignment.assignment_id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-gray-900">
                            {assignment.reviewer_name}
                          </h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(assignment.status)}`}>
                            {assignment.status.replace('_', ' ')}
                          </span>
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            {assignment.role}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}
                          </span>
                          {assignment.due_date && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              Due: {new Date(assignment.due_date).toLocaleDateString()}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Badge className="h-4 w-4" />
                            Weight: {assignment.weight}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {assignment.status === 'pending' && (
                          <button
                            onClick={() => {
                              setSelectedAssignment(assignment);
                              setShowDecisionDialog(true);
                            }}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Submit Review
                          </button>
                        )}
                        {assignment.completed_at && (
                          <span className="text-xs text-green-600">
                            Completed {new Date(assignment.completed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comments & Discussion */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-purple-500" />
                  Review Discussion ({comments.length})
                </h2>
              </div>
              
              {/* Add Comment */}
              <div className="p-4 border-b bg-gray-50">
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <select
                      value={commentType}
                      onChange={(e) => setCommentType(e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2 text-sm"
                    >
                      <option value="general">General Comment</option>
                      <option value="bias_concern">Bias Concern</option>
                      <option value="methodology">Methodology Issue</option>
                      <option value="statistical">Statistical Question</option>
                      <option value="regulatory">Regulatory Concern</option>
                    </select>
                    <div className="flex-1 relative">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none"
                        rows={2}
                        placeholder="Add your review comment..."
                      />
                    </div>
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      <Send className="h-4 w-4" />
                      Post
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Comment Threads */}
              <div className="p-4 space-y-4">
                {comments.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No comments yet. Start the discussion by adding your review insights.
                  </p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="space-y-3">
                      <div className="flex gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <div className="bg-white border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">
                                  {comment.author.name}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {comment.author.role}
                                </span>
                                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                                  {comment.comment_type.replace('_', ' ')}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500">
                                {new Date(comment.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-gray-700 text-sm">{comment.content}</p>
                          </div>
                          
                          {/* Replies */}
                          {comment.replies && comment.replies.length > 0 && (
                            <div className="ml-4 mt-2 space-y-2">
                              {comment.replies.map((reply) => (
                                <div key={reply.id} className="bg-gray-50 border rounded p-2">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-gray-900 text-sm">
                                      {reply.author.name}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {new Date(reply.created_at).toLocaleString()}
                                    </span>
                                  </div>
                                  <p className="text-gray-700 text-sm">{reply.content}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="col-span-4 space-y-6">
            {/* Workflow Progress */}
            {workflowProgress && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-500" />
                    Workflow Progress
                  </h3>
                </div>
                <div className="p-4">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                      <span className="text-sm font-bold text-green-600">
                        {(workflowProgress.overall_progress * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${workflowProgress.overall_progress * 100}%` }}
                      ></div>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700">Steps</h4>
                      {workflowProgress.completed_steps.map((step) => (
                        <div key={step} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-gray-600">{step.replace('_', ' ')}</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className="text-blue-600 font-medium">
                          {workflowProgress.current_step.replace('_', ' ')}
                        </span>
                      </div>
                      {workflowProgress.pending_steps.map((step) => (
                        <div key={step} className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-500">{step.replace('_', ' ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Review Guidelines */}
            <div className="bg-blue-50 rounded-lg border border-blue-200">
              <div className="p-4">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">Review Guidelines</h3>
                <div className="space-y-2 text-sm text-blue-800">
                  <p>• <strong>Bias Assessment:</strong> Look for selection, publication, and reporting biases</p>
                  <p>• <strong>Methodology:</strong> Evaluate study design, population, and endpoints</p>
                  <p>• <strong>Statistical Analysis:</strong> Check appropriateness of statistical methods</p>
                  <p>• <strong>Regulatory Context:</strong> Consider regulatory precedent and requirements</p>
                  <p>• <strong>Collaboration:</strong> Use comments to discuss with other reviewers</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
              </div>
              <div className="p-4 space-y-3">
                <button className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm">
                  <Eye className="h-4 w-4" />
                  View Evidence Details
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm">
                  <Edit3 className="h-4 w-4" />
                  Export Review Notes
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm">
                  <MessageCircle className="h-4 w-4" />
                  Contact Reviewer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Review Decision Dialog */}
      {showDecisionDialog && selectedAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Submit Review Decision</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Decision</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 'accepted', label: 'Accept', color: 'green' },
                    { value: 'rejected', label: 'Reject', color: 'red' },
                    { value: 'deferred', label: 'Defer', color: 'yellow' },
                    { value: 'pending', label: 'Pending', color: 'gray' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setReviewDecision({
                        ...reviewDecision,
                        decision: option.value as any
                      })}
                      className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                        reviewDecision.decision === option.value
                          ? `border-${option.color}-500 bg-${option.color}-50 text-${option.color}-700`
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {getDecisionIcon(option.value)}
                      <span className="block mt-1">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confidence Level: {(reviewDecision.confidence * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={reviewDecision.confidence}
                  onChange={(e) => setReviewDecision({
                    ...reviewDecision,
                    confidence: parseFloat(e.target.value)
                  })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rationale</label>
                <textarea
                  value={reviewDecision.rationale}
                  onChange={(e) => setReviewDecision({
                    ...reviewDecision,
                    rationale: e.target.value
                  })}
                  rows={4}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="Provide detailed rationale for your decision..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDecisionDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitDecision}
                disabled={!reviewDecision.rationale.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Submit Decision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Resolution Dialog */}
      {showConflictResolution && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resolve Review Conflicts</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Resolution Strategy
                </label>
                <select
                  value={conflictStrategy}
                  onChange={(e) => setConflictStrategy(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="majority_vote">Majority Vote</option>
                  <option value="senior_decision">Senior Reviewer Decision</option>
                  <option value="consensus_required">Consensus Required</option>
                  <option value="expert_panel">Expert Panel Review</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowConflictResolution(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveConflicts}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Resolve Conflicts
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollaborativeReviewComponent;