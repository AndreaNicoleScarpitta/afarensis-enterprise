import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChevronDown, 
  ChevronRight, 
  Settings, 
  Eye, 
  EyeOff, 
  Info, 
  BookOpen,
  Zap,
  Brain,
  Target,
  BarChart3
} from 'lucide-react'

interface InformationLayer {
  id: string
  level: 'essential' | 'detailed' | 'advanced' | 'expert'
  title: string
  content: React.ReactNode
  cognitiveLoad: number
  prerequisites?: string[]
  helpText?: string
  expertiseRequired: 'novice' | 'intermediate' | 'expert' | 'specialist'
}

interface AdaptiveSection {
  id: string
  title: string
  icon?: React.ElementType
  description?: string
  layers: InformationLayer[]
  defaultExpanded?: boolean
  isCollapsible?: boolean
  regulatorySignificance?: boolean
}

interface UserContext {
  expertiseLevel: 'novice' | 'intermediate' | 'expert' | 'specialist'
  cognitiveLoadThreshold: number
  informationDensity: number
  showHints: boolean
  autoExpandRelevant: boolean
  focusMode: boolean
}

interface ProgressiveDisclosureProps {
  sections: AdaptiveSection[]
  userContext: UserContext
  onUserContextChange: (context: UserContext) => void
  onCognitiveLoadAlert?: (load: number) => void
}

const ProgressiveDisclosure: React.FC<ProgressiveDisclosureProps> = ({
  sections,
  userContext,
  onUserContextChange,
  onCognitiveLoadAlert
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [visibleLayers, setVisibleLayers] = useState<Map<string, Set<string>>>(new Map())
  const [currentCognitiveLoad, setCurrentCognitiveLoad] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [focusSection, setFocusSection] = useState<string | null>(null)

  // Calculate cognitive load based on visible content
  const calculateCognitiveLoad = useMemo(() => {
    let totalLoad = 0
    
    sections.forEach(section => {
      if (expandedSections.has(section.id)) {
        const sectionLayers = visibleLayers.get(section.id) || new Set()
        section.layers.forEach(layer => {
          if (sectionLayers.has(layer.id)) {
            totalLoad += layer.cognitiveLoad
          }
        })
      }
    })
    
    return Math.min(totalLoad, 1.0) // Normalize to 0-1 scale
  }, [sections, expandedSections, visibleLayers])

  // Update cognitive load and trigger alerts
  useEffect(() => {
    setCurrentCognitiveLoad(calculateCognitiveLoad)
    
    if (calculateCognitiveLoad > userContext.cognitiveLoadThreshold && onCognitiveLoadAlert) {
      onCognitiveLoadAlert(calculateCognitiveLoad)
    }
  }, [calculateCognitiveLoad, userContext.cognitiveLoadThreshold, onCognitiveLoadAlert])

  // Auto-expand relevant sections based on user context
  useEffect(() => {
    if (userContext.autoExpandRelevant) {
      const relevantSections = sections
        .filter(section => 
          section.layers.some(layer => 
            layer.expertiseRequired === userContext.expertiseLevel ||
            (userContext.expertiseLevel === 'expert' && layer.level === 'advanced') ||
            (userContext.expertiseLevel === 'specialist' && layer.level === 'expert')
          )
        )
        .map(section => section.id)
      
      setExpandedSections(new Set(relevantSections))
    }
  }, [sections, userContext.autoExpandRelevant, userContext.expertiseLevel])

  // Get appropriate layers for user expertise level
  const getAppropriateLayersForSection = useCallback((section: AdaptiveSection) => {
    return section.layers.filter(layer => {
      switch (userContext.expertiseLevel) {
        case 'novice':
          return layer.level === 'essential' || layer.level === 'detailed'
        case 'intermediate':
          return layer.level !== 'expert'
        case 'expert':
          return true
        case 'specialist':
          return true
        default:
          return layer.level === 'essential'
      }
    })
  }, [userContext.expertiseLevel])

  // Auto-show layers based on information density preference
  useEffect(() => {
    const newVisibleLayers = new Map<string, Set<string>>()
    
    sections.forEach(section => {
      if (expandedSections.has(section.id)) {
        const appropriateLayers = getAppropriateLayersForSection(section)
        const layersToShow = new Set<string>()
        
        appropriateLayers.forEach(layer => {
          if (userContext.informationDensity >= 0.8) {
            // High density - show all appropriate layers
            layersToShow.add(layer.id)
          } else if (userContext.informationDensity >= 0.5) {
            // Medium density - show essential and some detailed
            if (layer.level === 'essential' || 
                (layer.level === 'detailed' && Math.random() < 0.7)) {
              layersToShow.add(layer.id)
            }
          } else {
            // Low density - show only essential
            if (layer.level === 'essential') {
              layersToShow.add(layer.id)
            }
          }
        })
        
        newVisibleLayers.set(section.id, layersToShow)
      }
    })
    
    setVisibleLayers(newVisibleLayers)
  }, [expandedSections, sections, userContext.informationDensity, getAppropriateLayersForSection])

  const toggleSection = useCallback((sectionId: string) => {
    if (userContext.focusMode && focusSection && focusSection !== sectionId) {
      // In focus mode, collapse current section and expand new one
      const newExpanded = new Set([sectionId])
      setExpandedSections(newExpanded)
      setFocusSection(sectionId)
    } else {
      // Normal mode - toggle section
      const newExpanded = new Set(expandedSections)
      if (expandedSections.has(sectionId)) {
        newExpanded.delete(sectionId)
        if (focusSection === sectionId) setFocusSection(null)
      } else {
        newExpanded.add(sectionId)
        if (userContext.focusMode) setFocusSection(sectionId)
      }
      setExpandedSections(newExpanded)
    }
  }, [expandedSections, userContext.focusMode, focusSection])

  const toggleLayer = useCallback((sectionId: string, layerId: string) => {
    const sectionLayers = visibleLayers.get(sectionId) || new Set()
    const newSectionLayers = new Set(sectionLayers)
    
    if (sectionLayers.has(layerId)) {
      newSectionLayers.delete(layerId)
    } else {
      newSectionLayers.add(layerId)
    }
    
    const newVisibleLayers = new Map(visibleLayers)
    newVisibleLayers.set(sectionId, newSectionLayers)
    setVisibleLayers(newVisibleLayers)
  }, [visibleLayers])

  const getExpertiseIcon = (level: string) => {
    switch (level) {
      case 'essential': return <BookOpen className="w-4 h-4" />
      case 'detailed': return <Eye className="w-4 h-4" />
      case 'advanced': return <Brain className="w-4 h-4" />
      case 'expert': return <Target className="w-4 h-4" />
      default: return <Info className="w-4 h-4" />
    }
  }

  const getExpertiseColor = (level: string) => {
    switch (level) {
      case 'essential': return 'text-green-600 bg-green-50'
      case 'detailed': return 'text-blue-600 bg-blue-50'
      case 'advanced': return 'text-purple-600 bg-purple-50'
      case 'expert': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-primary-600" />
                <span className="heading-5">Adaptive Content</span>
              </div>
              
              {/* Cognitive Load Indicator */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-600">Cognitive Load:</span>
                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full transition-colors ${
                      currentCognitiveLoad > 0.8 ? 'bg-red-500' :
                      currentCognitiveLoad > 0.6 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${currentCognitiveLoad * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700">
                  {Math.round(currentCognitiveLoad * 100)}%
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Expertise Level Indicator */}
              <span className={`
                inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                ${getExpertiseColor(userContext.expertiseLevel)}
              `}>
                {userContext.expertiseLevel.toUpperCase()}
              </span>

              {/* Settings Toggle */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="btn btn-secondary btn-sm"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-gray-200 p-4 bg-gray-50"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Information Density */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Information Density
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={userContext.informationDensity}
                    onChange={(e) => onUserContextChange({
                      ...userContext,
                      informationDensity: parseFloat(e.target.value)
                    })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Minimal</span>
                    <span>Comprehensive</span>
                  </div>
                </div>

                {/* Cognitive Load Threshold */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cognitive Load Alert
                  </label>
                  <input
                    type="range"
                    min="0.3"
                    max="1"
                    step="0.1"
                    value={userContext.cognitiveLoadThreshold}
                    onChange={(e) => onUserContextChange({
                      ...userContext,
                      cognitiveLoadThreshold: parseFloat(e.target.value)
                    })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>30%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Display Options */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Display Options
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={userContext.showHints}
                      onChange={(e) => onUserContextChange({
                        ...userContext,
                        showHints: e.target.checked
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm">Show contextual hints</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={userContext.autoExpandRelevant}
                      onChange={(e) => onUserContextChange({
                        ...userContext,
                        autoExpandRelevant: e.target.checked
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm">Auto-expand relevant sections</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={userContext.focusMode}
                      onChange={(e) => onUserContextChange({
                        ...userContext,
                        focusMode: e.target.checked
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm">Focus mode (one section at a time)</span>
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content Sections */}
      <div className="space-y-4">
        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.id)
          const sectionLayers = visibleLayers.get(section.id) || new Set()
          const appropriateLayers = getAppropriateLayersForSection(section)
          const Icon = section.icon || Info

          return (
            <div
              key={section.id}
              className={`
                card transition-all duration-300
                ${userContext.focusMode && focusSection === section.id ? 'ring-2 ring-primary-500' : ''}
                ${section.regulatorySignificance ? 'border-l-4 border-l-red-500' : ''}
              `}
            >
              <div
                className="card-header cursor-pointer select-none"
                onClick={() => toggleSection(section.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <motion.div
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </motion.div>
                    
                    <Icon className="w-5 h-5 text-primary-600" />
                    
                    <div>
                      <h3 className="heading-4">{section.title}</h3>
                      {section.description && (
                        <p className="body-small text-gray-600">{section.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {section.regulatorySignificance && (
                      <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                        Regulatory
                      </span>
                    )}
                    
                    <span className="text-xs text-gray-500">
                      {appropriateLayers.length} layer{appropriateLayers.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="card-body border-t border-gray-200 pt-0">
                      <div className="space-y-4 mt-4">
                        {appropriateLayers.map((layer) => {
                          const isLayerVisible = sectionLayers.has(layer.id)
                          
                          return (
                            <div
                              key={layer.id}
                              className={`
                                border rounded-lg transition-all
                                ${isLayerVisible ? 'border-primary-200 bg-primary-25' : 'border-gray-200'}
                              `}
                            >
                              <div
                                className="p-3 cursor-pointer select-none flex items-center justify-between"
                                onClick={() => toggleLayer(section.id, layer.id)}
                              >
                                <div className="flex items-center space-x-3">
                                  <motion.div
                                    animate={{ rotate: isLayerVisible ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                  </motion.div>
                                  
                                  {getExpertiseIcon(layer.level)}
                                  
                                  <div>
                                    <span className="text-sm font-medium">{layer.title}</span>
                                    {userContext.showHints && layer.helpText && (
                                      <p className="text-xs text-gray-500">{layer.helpText}</p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                  <span className={`
                                    inline-flex items-center px-2 py-1 rounded text-xs font-medium
                                    ${getExpertiseColor(layer.level)}
                                  `}>
                                    {layer.level}
                                  </span>
                                  
                                  <div className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${
                                        layer.cognitiveLoad > 0.7 ? 'bg-red-400' :
                                        layer.cognitiveLoad > 0.4 ? 'bg-yellow-400' :
                                        'bg-green-400'
                                      }`}
                                      style={{ width: `${layer.cognitiveLoad * 100}%` }}
                                    />
                                  </div>
                                </div>
                              </div>

                              <AnimatePresence>
                                {isLayerVisible && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    <div className="px-4 pb-4 border-t border-gray-100">
                                      <div className="pt-3">
                                        {layer.content}
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      {/* Cognitive Load Alert */}
      <AnimatePresence>
        {currentCognitiveLoad > userContext.cognitiveLoadThreshold && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 right-4 bg-warning-100 border border-warning-300 rounded-lg p-4 shadow-lg max-w-sm z-50"
          >
            <div className="flex items-start space-x-3">
              <Brain className="w-5 h-5 text-warning-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-warning-800 mb-1">
                  High Cognitive Load Detected
                </h4>
                <p className="text-xs text-warning-700">
                  Consider hiding some detailed sections or switching to focus mode to reduce information overload.
                </p>
                <div className="mt-2 flex space-x-2">
                  <button
                    onClick={() => onUserContextChange({
                      ...userContext,
                      focusMode: true
                    })}
                    className="text-xs bg-warning-200 text-warning-800 px-2 py-1 rounded hover:bg-warning-300"
                  >
                    Enable Focus Mode
                  </button>
                  <button
                    onClick={() => onUserContextChange({
                      ...userContext,
                      informationDensity: Math.max(0.1, userContext.informationDensity - 0.2)
                    })}
                    className="text-xs bg-warning-200 text-warning-800 px-2 py-1 rounded hover:bg-warning-300"
                  >
                    Reduce Density
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ProgressiveDisclosure
