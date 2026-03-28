import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle,
  Users,
  CheckCircle,
  AlertTriangle,
  ThumbsUp
} from 'lucide-react'

interface User {
  id: string
  name: string
  email: string
  avatar: string
  role: 'admin' | 'reviewer' | 'analyst' | 'viewer'
  isOnline: boolean
  expertise: string[]
}

interface Comment {
  id: string
  userId: string
  content: string
  timestamp: string
  anchorText?: string
  anchorPosition: {
    start: number
    end: number
    sectionId: string
  }
  replies: Comment[]
  mentions: string[]
  reactions: {
    userId: string
    type: 'like' | 'dislike' | 'approve' | 'concern'
  }[]
  isResolved: boolean
  aiSuggestions?: {
    type: 'regulatory_concern' | 'quality_issue' | 'bias_detection' | 'completeness'
    message: string
    confidence: number
  }[]
}

interface LiveCursor {
  userId: string
  position: { x: number; y: number }
  selection?: {
    start: number
    end: number
    sectionId: string
  }
  timestamp: string
}

interface ConflictResolution {
  id: string
  evidenceId: string
  conflictType: 'rating_disagreement' | 'inclusion_decision' | 'quality_assessment'
  participants: string[]
  positions: {
    userId: string
    position: 'approve' | 'reject' | 'request_more_info'
    rationale: string
    confidence: number
  }[]
  resolution?: {
    finalDecision: string
    resolvedBy: string
    timestamp: string
    reasoning: string
  }
  escalation?: {
    escalatedTo: string
    timestamp: string
    reason: string
  }
}

interface CollaborativeReviewProps {
  evidenceId: string
  currentUser: User
  onDecisionSubmit: (decision: any) => void
  onConflictEscalate: (conflict: ConflictResolution) => void
}

const CollaborativeReview: React.FC<CollaborativeReviewProps> = ({
  evidenceId,
  currentUser,
  onDecisionSubmit,
  onConflictEscalate
}) => {
  const [activeUsers, setActiveUsers] = useState<User[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [liveCursors, setLiveCursors] = useState<LiveCursor[]>([])
  const [conflicts, setConflicts] = useState<ConflictResolution[]>([])
  const [selectedText, setSelectedText] = useState<{
    text: string
    position: { start: number; end: number; sectionId: string }
  } | null>(null)
  const [showCommentBox, setShowCommentBox] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [mentionUsers, setMentionUsers] = useState<User[]>([])
  const [showMentions, setShowMentions] = useState(false)
  const [_reviewDecision, _setReviewDecision] = useState<{
    decision: 'approve' | 'reject' | 'request_more_info'
    confidence: number
    rationale: string
  } | null>(null)

  const contentRef = useRef<HTMLDivElement>(null)
  const commentBoxRef = useRef<HTMLTextAreaElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // WebSocket connection for real-time collaboration
  // Uses dynamic URL based on current page origin (works in dev + production)
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${proto}//${window.location.host}/api/v1/evidence/${evidenceId}/collaborate`
    let ws: WebSocket | null = null

    try {
      ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          switch (data.type) {
            case 'user_joined':
              setActiveUsers(prev => [...prev.filter(u => u.id !== data.user.id), data.user])
              break
            case 'user_left':
              setActiveUsers(prev => prev.filter(u => u.id !== data.userId))
              break
            case 'cursor_update':
              setLiveCursors(prev => [
                ...prev.filter(c => c.userId !== data.cursor.userId),
                data.cursor
              ])
              break
            case 'comment_added':
              setComments(prev => [...prev, data.comment])
              break
            case 'comment_updated':
              setComments(prev => prev.map(c => c.id === data.comment.id ? data.comment : c))
              break
            case 'conflict_detected':
              setConflicts(prev => [...prev, data.conflict])
              break
          }
        } catch { /* ignore parse errors */ }
      }

      ws.onopen = () => {
        ws?.send(JSON.stringify({
          type: 'join_session',
          userId: currentUser.id,
          evidenceId
        }))
      }

      // Silent error handling — WS may not be available in all environments
      ws.onerror = () => { /* intentionally silent */ }
    } catch {
      // WebSocket construction failed — collaboration features will be unavailable
    }

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({
            type: 'leave_session',
            userId: currentUser.id,
            evidenceId
          }))
        } catch { /* ignore send errors during teardown */ }
      }
      ws?.close()
    }
  }, [evidenceId, currentUser.id])

  // Track mouse position for cursor sharing
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const cursor = {
        userId: currentUser.id,
        position: { x: event.clientX, y: event.clientY },
        timestamp: new Date().toISOString()
      }
      
      wsRef.current.send(JSON.stringify({
        type: 'cursor_update',
        cursor
      }))
    }
  }, [currentUser.id])

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    return () => document.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  // Handle text selection for comments
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection()
    if (selection && selection.toString().length > 0) {
      const range = selection.getRangeAt(0)
      const selectedText = selection.toString()
      
      // Find the section ID from the selected element
      let sectionElement = range.commonAncestorContainer.parentElement
      while (sectionElement && !sectionElement.dataset.sectionId) {
        sectionElement = sectionElement.parentElement
      }
      
      if (sectionElement) {
        setSelectedText({
          text: selectedText,
          position: {
            start: range.startOffset,
            end: range.endOffset,
            sectionId: sectionElement.dataset.sectionId || ''
          }
        })
        setShowCommentBox(true)
      }
    }
  }, [])

  useEffect(() => {
    document.addEventListener('mouseup', handleTextSelection)
    return () => document.removeEventListener('mouseup', handleTextSelection)
  }, [handleTextSelection])

  const handleAddComment = useCallback(async () => {
    if (!newComment.trim() || !selectedText) return

    const comment: Comment = {
      id: `comment_${Date.now()}`,
      userId: currentUser.id,
      content: newComment,
      timestamp: new Date().toISOString(),
      anchorText: selectedText.text,
      anchorPosition: selectedText.position,
      replies: [],
      mentions: extractMentions(newComment),
      reactions: [],
      isResolved: false
    }

    // Add automated suggestions if relevant
    if (newComment.toLowerCase().includes('bias') || newComment.toLowerCase().includes('quality')) {
      comment.aiSuggestions = await generateAISuggestions(newComment, selectedText.text)
    }

    setComments(prev => [...prev, comment])
    
    // Send to WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'comment_added',
        comment
      }))
    }

    setNewComment('')
    setShowCommentBox(false)
    setSelectedText(null)
  }, [newComment, selectedText, currentUser.id])

  const handleMention = useCallback((username: string) => {
    const mentionIndex = newComment.lastIndexOf('@')
    if (mentionIndex !== -1) {
      const beforeMention = newComment.slice(0, mentionIndex)
      const afterMention = newComment.slice(mentionIndex).replace(/@\w*/, `@${username} `)
      setNewComment(beforeMention + afterMention)
    }
    setShowMentions(false)
  }, [newComment])

  const handleCommentInputChange = useCallback((value: string) => {
    setNewComment(value)
    
    // Check for @ mentions
    const lastAtIndex = value.lastIndexOf('@')
    if (lastAtIndex !== -1) {
      const afterAt = value.slice(lastAtIndex + 1)
      if (afterAt.length > 0 && !afterAt.includes(' ')) {
        const filteredUsers = activeUsers.filter(user => 
          user.name.toLowerCase().includes(afterAt.toLowerCase())
        )
        setMentionUsers(filteredUsers)
        setShowMentions(filteredUsers.length > 0)
      } else {
        setShowMentions(false)
      }
    } else {
      setShowMentions(false)
    }
  }, [activeUsers])

  const handleReaction = useCallback(async (commentId: string, reactionType: 'like' | 'dislike' | 'approve' | 'concern') => {
    const updatedComments = comments.map(comment => {
      if (comment.id === commentId) {
        const existingReaction = comment.reactions.find(r => r.userId === currentUser.id)
        let newReactions = comment.reactions.filter(r => r.userId !== currentUser.id)
        
        if (!existingReaction || existingReaction.type !== reactionType) {
          newReactions.push({ userId: currentUser.id, type: reactionType })
        }
        
        return { ...comment, reactions: newReactions }
      }
      return comment
    })
    
    setComments(updatedComments)
  }, [comments, currentUser.id])

  const handleConflictResolution = useCallback(async (conflict: ConflictResolution, decision: string) => {
    const updatedConflict = {
      ...conflict,
      resolution: {
        finalDecision: decision,
        resolvedBy: currentUser.id,
        timestamp: new Date().toISOString(),
        reasoning: `Consensus reached through collaborative review`
      }
    }
    
    setConflicts(prev => prev.map(c => c.id === conflict.id ? updatedConflict : c))
    
    // Submit final decision
    onDecisionSubmit({
      evidenceId,
      decision,
      resolvedBy: currentUser.id,
      collaborativeReview: true
    })
  }, [currentUser.id, evidenceId, onDecisionSubmit])

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g
    const mentions: string[] = []
    let match
    while ((match = mentionRegex.exec(text)) !== null) {
      if (match[1]) mentions.push(match[1])
    }
    return mentions
  }

  const generateAISuggestions = async (comment: string, _anchorText: string) => {
    // Placeholder for automated suggestion generation
    // In real implementation, this would call the analysis service
    const suggestions = []
    
    if (comment.toLowerCase().includes('bias')) {
      suggestions.push({
        type: 'bias_detection' as const,
        message: 'Consider analyzing this section for potential selection bias.',
        confidence: 0.75
      })
    }
    
    if (comment.toLowerCase().includes('quality')) {
      suggestions.push({
        type: 'quality_issue' as const,
        message: 'This may affect the overall evidence quality assessment.',
        confidence: 0.68
      })
    }
    
    return suggestions
  }

  const getUserColor = (userId: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500',
      'bg-red-500', 'bg-indigo-500', 'bg-pink-500', 'bg-gray-500'
    ]
    const hash = userId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    return colors[Math.abs(hash) % colors.length]
  }

  return (
    <div className="space-y-6">
      {/* Active Users Bar */}
      <div className="card">
        <div className="card-body py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Users className="w-5 h-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                {activeUsers.length} reviewer{activeUsers.length !== 1 ? 's' : ''} active
              </span>
              
              <div className="flex -space-x-2">
                {activeUsers.slice(0, 5).map(user => (
                  <div
                    key={user.id}
                    className={`
                      w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-medium
                      ${getUserColor(user.id)}
                    `}
                    title={`${user.name} (${user.role})`}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                ))}
                {activeUsers.length > 5 && (
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-400 flex items-center justify-center text-white text-xs font-medium">
                    +{activeUsers.length - 5}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>Live collaboration</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Cursors */}
      {liveCursors.map(cursor => {
        const user = activeUsers.find(u => u.id === cursor.userId)
        if (!user || cursor.userId === currentUser.id) return null
        
        return (
          <div
            key={cursor.userId}
            className="fixed pointer-events-none z-50"
            style={{
              left: cursor.position.x,
              top: cursor.position.y,
              transform: 'translate(-2px, -2px)'
            }}
          >
            <div className={`w-4 h-4 ${getUserColor(cursor.userId)} rounded-full border border-white`}>
              <div className="absolute top-4 left-0 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                {user.name}
              </div>
            </div>
          </div>
        )
      })}

      {/* Main Content Area with Comments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evidence Content */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <h3 className="heading-4">Evidence Review</h3>
            </div>
            <div 
              ref={contentRef}
              className="card-body prose max-w-none"
              data-section-id="main-content"
            >
              {/* Placeholder evidence content */}
              <div data-section-id="abstract">
                <h4>Abstract</h4>
                <p>
                  This randomized, double-blind, placebo-controlled trial evaluated the efficacy and safety 
                  of the investigational treatment in patients with advanced disease. The primary endpoint 
                  was overall survival, with secondary endpoints including progression-free survival and 
                  safety assessments.
                </p>
              </div>
              
              <div data-section-id="methodology">
                <h4>Methodology</h4>
                <p>
                  A total of 245 patients were randomized 1:1 to receive either the investigational treatment 
                  or placebo. Patients were stratified by disease stage and prior therapy. The study was 
                  conducted across 25 centers internationally.
                </p>
              </div>
              
              <div data-section-id="results">
                <h4>Results</h4>
                <p>
                  The median overall survival was 18.2 months in the treatment group compared to 12.5 months 
                  in the placebo group (HR 0.72, 95% CI: 0.58-0.89, p=0.002). Treatment-related adverse 
                  events were manageable and consistent with the known safety profile.
                </p>
              </div>

              {/* Comment anchors */}
              {comments.map(comment => (
                <div
                  key={comment.id}
                  className="absolute bg-yellow-200 opacity-50 pointer-events-none"
                  data-comment-id={comment.id}
                  title={`Comment by ${activeUsers.find(u => u.id === comment.userId)?.name}: ${comment.content}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Comments Panel */}
        <div className="space-y-4">
          {/* Comment Input */}
          <AnimatePresence>
            {showCommentBox && selectedText && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="card border-primary-200 bg-primary-50"
              >
                <div className="card-body">
                  <div className="mb-3">
                    <div className="text-xs text-gray-600 mb-1">Selected text:</div>
                    <div className="bg-yellow-100 border border-yellow-300 rounded p-2 text-sm">
                      "{selectedText.text}"
                    </div>
                  </div>
                  
                  <div className="relative">
                    <textarea
                      ref={commentBoxRef}
                      value={newComment}
                      onChange={(e) => handleCommentInputChange(e.target.value)}
                      placeholder="Add a comment or mention someone with @..."
                      className="w-full h-24 p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    
                    {/* Mention Suggestions */}
                    <AnimatePresence>
                      {showMentions && mentionUsers.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-32 overflow-y-auto"
                        >
                          {mentionUsers.map(user => (
                            <button
                              key={user.id}
                              onClick={() => handleMention(user.name.toLowerCase().replace(/\s+/g, ''))}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center space-x-2"
                            >
                              <div className={`w-6 h-6 rounded-full ${getUserColor(user.id)} flex items-center justify-center text-white text-xs`}>
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-medium">{user.name}</div>
                                <div className="text-xs text-gray-500">{user.role}</div>
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  <div className="flex justify-between items-center mt-3">
                    <button
                      onClick={() => {
                        setShowCommentBox(false)
                        setNewComment('')
                        setSelectedText(null)
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      className="btn btn-primary btn-sm"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Add Comment
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Comments List */}
          <div className="card">
            <div className="card-header">
              <h4 className="heading-5">Comments ({comments.length})</h4>
            </div>
            <div className="card-body space-y-4 max-h-96 overflow-y-auto">
              {comments.map(comment => {
                const user = activeUsers.find(u => u.id === comment.userId)
                return (
                  <div key={comment.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className={`w-8 h-8 rounded-full ${getUserColor(comment.userId)} flex items-center justify-center text-white text-sm font-medium`}>
                        {user?.name.charAt(0).toUpperCase()}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-medium">{user?.name}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(comment.timestamp).toLocaleTimeString()}
                          </span>
                          {comment.isResolved && (
                            <CheckCircle className="w-4 h-4 text-success-500" />
                          )}
                        </div>
                        
                        {comment.anchorText && (
                          <div className="bg-gray-100 border border-gray-200 rounded p-2 mb-2 text-xs">
                            <span className="text-gray-600">On: </span>
                            "{comment.anchorText}"
                          </div>
                        )}
                        
                        <p className="text-sm text-gray-700 mb-2">{comment.content}</p>
                        
                        {/* Automated Suggestions */}
                        {comment.aiSuggestions && comment.aiSuggestions.length > 0 && (
                          <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-2">
                            <div className="text-xs font-medium text-blue-700 mb-1">Automated Suggestions:</div>
                            {comment.aiSuggestions.map((suggestion, idx) => (
                              <div key={idx} className="text-xs text-blue-600">
                                {suggestion.message} ({Math.round(suggestion.confidence * 100)}% confidence)
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Reactions */}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleReaction(comment.id, 'like')}
                            className={`
                              flex items-center space-x-1 px-2 py-1 rounded text-xs
                              ${comment.reactions.some(r => r.userId === currentUser.id && r.type === 'like')
                                ? 'bg-blue-100 text-blue-700'
                                : 'hover:bg-gray-100 text-gray-600'
                              }
                            `}
                          >
                            <ThumbsUp className="w-3 h-3" />
                            <span>{comment.reactions.filter(r => r.type === 'like').length}</span>
                          </button>
                          
                          <button
                            onClick={() => handleReaction(comment.id, 'approve')}
                            className={`
                              flex items-center space-x-1 px-2 py-1 rounded text-xs
                              ${comment.reactions.some(r => r.userId === currentUser.id && r.type === 'approve')
                                ? 'bg-green-100 text-green-700'
                                : 'hover:bg-gray-100 text-gray-600'
                              }
                            `}
                          >
                            <CheckCircle className="w-3 h-3" />
                            <span>{comment.reactions.filter(r => r.type === 'approve').length}</span>
                          </button>
                          
                          <button
                            onClick={() => handleReaction(comment.id, 'concern')}
                            className={`
                              flex items-center space-x-1 px-2 py-1 rounded text-xs
                              ${comment.reactions.some(r => r.userId === currentUser.id && r.type === 'concern')
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'hover:bg-gray-100 text-gray-600'
                              }
                            `}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>{comment.reactions.filter(r => r.type === 'concern').length}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              
              {comments.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No comments yet. Select text to add the first comment.</p>
                </div>
              )}
            </div>
          </div>

          {/* Conflicts Resolution */}
          {conflicts.length > 0 && (
            <div className="card border-warning-200 bg-warning-50">
              <div className="card-header">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-warning-600" />
                  <h4 className="heading-5 text-warning-800">Review Conflicts ({conflicts.length})</h4>
                </div>
              </div>
              <div className="card-body space-y-3">
                {conflicts.filter(c => !c.resolution).map(conflict => (
                  <div key={conflict.id} className="bg-white border border-warning-200 rounded p-3">
                    <div className="text-sm font-medium text-warning-800 mb-2">
                      {conflict.conflictType.replace('_', ' ').toUpperCase()}
                    </div>
                    <div className="space-y-2 mb-3">
                      {conflict.positions.map(position => {
                        const user = activeUsers.find(u => u.id === position.userId)
                        return (
                          <div key={position.userId} className="flex items-center justify-between text-sm">
                            <span>{user?.name}: {position.position}</span>
                            <span className="text-xs text-gray-500">
                              {Math.round(position.confidence * 100)}% confident
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleConflictResolution(conflict, 'approve')}
                        className="btn btn-success btn-sm"
                      >
                        Resolve: Approve
                      </button>
                      <button
                        onClick={() => handleConflictResolution(conflict, 'reject')}
                        className="btn btn-error btn-sm"
                      >
                        Resolve: Reject
                      </button>
                      <button
                        onClick={() => onConflictEscalate(conflict)}
                        className="btn btn-warning btn-sm"
                      >
                        Escalate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CollaborativeReview
