import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  Save, 
  TrendingUp, 
  Network, 
  Brain,
  FileText,
  Users,
  Calendar,
  Target,
  ArrowRight,
  Star,
  Clock,
  Tag
} from 'lucide-react';
import { useApiRequest } from '../services/hooks';
import { apiClient } from '../services/apiClient';

interface SearchResult {
  evidence_id: string;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  publication_year: number;
  relevance_score: number;
  search_type: string;
  similarity_reasons: string[];
  citation_count: number;
  related_evidence_ids: string[];
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  search_type: string;
  filters: Record<string, any>;
  alert_frequency: string | null;
  created_at: string;
  last_run: string | null;
}

const AdvancedSearchComponent: React.FC = () => {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'semantic' | 'hybrid' | 'keyword'>('hybrid');
  const [semanticWeight, setSemanticWeight] = useState(0.7);
  const [filters, setFilters] = useState({
    publication_year_start: 2020,
    publication_year_end: 2024,
    journal: '',
    source_type: '',
    authors: [] as string[]
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [recommendations, setRecommendations] = useState<SearchResult[]>([]);

  // API hooks
  const { data: savedSearchesData } = useApiRequest<{ saved_searches: SavedSearch[] }>(
    '/api/v1/search/saved'
  );

  useEffect(() => {
    if (savedSearchesData?.saved_searches) {
      setSavedSearches(savedSearchesData.saved_searches);
    }
  }, [savedSearchesData]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const endpoint = searchType === 'semantic' 
        ? '/api/v1/search/semantic'
        : '/api/v1/search/hybrid';

      const searchRequest = {
        query,
        filters,
        limit: 20,
        ...(searchType === 'hybrid' && { semantic_weight: semanticWeight })
      };

      const response = await apiClient.post<{
        results: SearchResult[];
        total_results: number;
      }>(endpoint, searchRequest);

      setResults(response.data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query, searchType, semanticWeight, filters]);

  const handleSaveSearch = async () => {
    if (!saveSearchName.trim() || !query.trim()) return;

    try {
      await apiClient.post('/api/v1/search/save', {
        name: saveSearchName,
        query,
        search_type: searchType,
        filters,
        alert_frequency: null
      });

      // Refresh saved searches
      const savedData = await apiClient.get<{ saved_searches: SavedSearch[] }>('/api/v1/search/saved');
      setSavedSearches(savedData.data.saved_searches || []);
      
      setShowSaveDialog(false);
      setSaveSearchName('');
    } catch (error) {
      console.error('Failed to save search:', error);
    }
  };

  const loadSavedSearch = (savedSearch: SavedSearch) => {
    setQuery(savedSearch.query);
    setSearchType(savedSearch.search_type as any);
    setFilters(savedSearch.filters);
  };

  const getRecommendations = async (evidenceId: string) => {
    try {
      const response = await apiClient.get<{
        recommendations: SearchResult[];
      }>(`/api/v1/search/recommendations/${evidenceId}?recommendation_type=similar&limit=5`);
      
      setRecommendations(response.data.recommendations || []);
    } catch (error) {
      console.error('Failed to get recommendations:', error);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setSelectedResult(result);
    getRecommendations(result.evidence_id);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Advanced Evidence Search & Discovery
          </h1>
          <p className="text-gray-600">
            Systematic semantic search with citation analysis and intelligent recommendations
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Main Search Panel */}
          <div className="col-span-8 space-y-6">
            {/* Search Interface */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="space-y-4">
                {/* Search Input */}
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Search for evidence, studies, or specific topics..."
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={isSearching || !query.trim()}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSearching ? (
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Brain className="h-5 w-5" />
                    )}
                    {searchType === 'semantic' ? 'Semantic Search' : 'Hybrid Search'}
                  </button>
                </div>

                {/* Search Type & Options */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700">Search Type:</label>
                    <select
                      value={searchType}
                      onChange={(e) => setSearchType(e.target.value as any)}
                      className="border border-gray-300 rounded px-3 py-1 text-sm"
                    >
                      <option value="hybrid">Hybrid (Recommended)</option>
                      <option value="semantic">Semantic Only</option>
                      <option value="keyword">Keyword Only</option>
                    </select>
                    
                    {searchType === 'hybrid' && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">Semantic Weight:</label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={semanticWeight}
                          onChange={(e) => setSemanticWeight(parseFloat(e.target.value))}
                          className="w-16"
                        />
                        <span className="text-sm text-gray-600">{(semanticWeight * 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      className="flex items-center gap-2 px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                    >
                      <Filter className="h-4 w-4" />
                      Filters
                    </button>
                    <button
                      onClick={() => setShowSaveDialog(true)}
                      disabled={!query.trim()}
                      className="flex items-center gap-2 px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      Save
                    </button>
                  </div>
                </div>

                {/* Advanced Filters */}
                {showAdvancedFilters && (
                  <div className="border-t pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Publication Year Range
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={filters.publication_year_start}
                            onChange={(e) => setFilters({
                              ...filters,
                              publication_year_start: parseInt(e.target.value)
                            })}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                            min="1990"
                            max="2024"
                          />
                          <span className="text-gray-500">to</span>
                          <input
                            type="number"
                            value={filters.publication_year_end}
                            onChange={(e) => setFilters({
                              ...filters,
                              publication_year_end: parseInt(e.target.value)
                            })}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                            min="1990"
                            max="2024"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Journal
                        </label>
                        <input
                          type="text"
                          value={filters.journal}
                          onChange={(e) => setFilters({ ...filters, journal: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          placeholder="Filter by journal name..."
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Search Results */}
            {results.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4 border-b">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Search Results ({results.length})
                  </h2>
                </div>
                <div className="divide-y">
                  {results.map((result, index) => (
                    <div
                      key={`${result.evidence_id}-${index}`}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedResult?.evidence_id === result.evidence_id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                      onClick={() => handleResultClick(result)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-medium text-gray-900 line-clamp-2">
                          {result.title}
                        </h3>
                        <div className="flex items-center gap-2 ml-4">
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-600 font-medium">
                              {(result.relevance_score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-600 mb-3 line-clamp-3">
                        {result.abstract}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {result.authors.slice(0, 2).join(', ')}
                            {result.authors.length > 2 && ` +${result.authors.length - 2}`}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {result.publication_year}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            {result.journal}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {result.similarity_reasons.map((reason, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                            >
                              {reason}
                            </span>
                          ))}
                          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 px-2 py-1 rounded">
                            {result.search_type}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations Panel */}
            {selectedResult && recommendations.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4 border-b">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Network className="h-5 w-5 text-purple-500" />
                    Similar Evidence
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Automated recommendations based on "{selectedResult.title}"
                  </p>
                </div>
                <div className="p-4 space-y-3">
                  {recommendations.map((rec, index) => (
                    <div
                      key={`rec-${rec.evidence_id}-${index}`}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <ArrowRight className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 line-clamp-1">
                          {rec.title}
                        </h4>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {rec.abstract}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-gray-500">
                            {rec.publication_year} • {rec.journal}
                          </span>
                          <span className="text-xs text-purple-600 font-medium">
                            {(rec.relevance_score * 100).toFixed(0)}% match
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="col-span-4 space-y-6">
            {/* Saved Searches */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Saved Searches
                </h2>
              </div>
              <div className="p-4">
                {savedSearches.length === 0 ? (
                  <p className="text-gray-500 text-sm">No saved searches yet</p>
                ) : (
                  <div className="space-y-3">
                    {savedSearches.map((saved) => (
                      <div
                        key={saved.id}
                        className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => loadSavedSearch(saved)}
                      >
                        <h4 className="font-medium text-gray-900 text-sm">{saved.name}</h4>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{saved.query}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Tag className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                          <span className="text-xs text-gray-500">{saved.search_type}</span>
                          {saved.last_run && (
                            <>
                              <Clock className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                              <span className="text-xs text-gray-500">
                                {new Date(saved.last_run).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Search Tips */}
            <div className="bg-blue-50 rounded-lg border border-blue-200">
              <div className="p-4">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">Search Tips</h3>
                <div className="space-y-2 text-sm text-blue-800">
                  <p>• Use <strong>semantic search</strong> for concept-based discovery</p>
                  <p>• Try <strong>hybrid search</strong> for best of both worlds</p>
                  <p>• Save searches to track new evidence over time</p>
                  <p>• Click results to see automated recommendations</p>
                  <p>• Use filters to narrow down by year or journal</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Search Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Save Search</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Name
                </label>
                <input
                  type="text"
                  value={saveSearchName}
                  onChange={(e) => setSaveSearchName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="e.g., Diabetes Treatment Studies"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Query
                </label>
                <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{query}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSearch}
                disabled={!saveSearchName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Save Search
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedSearchComponent;