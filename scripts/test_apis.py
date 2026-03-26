#!/usr/bin/env python3
"""
API Testing and Validation Script for Afarensis Enterprise
Tests all configured APIs and provides detailed diagnostics
"""

import os
import sys
import asyncio
import logging
import json
import time
from typing import Dict, List, Any, Optional
from datetime import datetime

# Try to import our services
try:
    from app.services.llm_integration import LLMServiceIntegration
    from app.services.external_apis import ExternalAPIService
    SERVICES_AVAILABLE = True
except ImportError:
    SERVICES_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class APITester:
    """Comprehensive API testing and validation"""
    
    def __init__(self):
        self.test_results = {}
        self.performance_metrics = {}
        
    def load_environment(self):
        """Load environment variables from .env file"""
        env_file = '.env'
        if os.path.exists(env_file):
            with open(env_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        # Remove quotes if present
                        value = value.strip('"\'')
                        os.environ[key] = value
            print(f"✅ Loaded environment from {env_file}")
        else:
            print("⚠️ No .env file found - using system environment variables")
    
    async def test_anthropic_api(self) -> Dict[str, Any]:
        """Test Claude/Anthropic API"""
        print("\n🔍 Testing Claude/Anthropic API...")
        
        if not os.getenv('ANTHROPIC_API_KEY'):
            return {'status': 'skipped', 'reason': 'No API key configured'}
        
        if not SERVICES_AVAILABLE:
            return {'status': 'error', 'reason': 'Service modules not available'}
        
        try:
            start_time = time.time()
            
            # Initialize LLM service
            llm_service = LLMServiceIntegration()
            
            # Test basic functionality
            test_response = await llm_service.call_claude(
                prompt="This is an API test. Please respond with exactly 'Claude API test successful'.",
                system_prompt="You are an API testing assistant.",
                max_tokens=50
            )
            
            response_time = (time.time() - start_time) * 1000
            
            # Validate response
            if "claude api test successful" in test_response.content.lower():
                # Test advanced functionality
                advanced_test = await self._test_advanced_claude_features(llm_service)
                
                return {
                    'status': 'success',
                    'response_time_ms': int(response_time),
                    'model': test_response.model,
                    'tokens_used': test_response.tokens_used,
                    'confidence': test_response.confidence,
                    'advanced_features': advanced_test
                }
            else:
                return {
                    'status': 'error',
                    'reason': f'Unexpected response: {test_response.content[:100]}',
                    'response_time_ms': int(response_time)
                }
                
        except Exception as e:
            return {
                'status': 'error',
                'reason': str(e),
                'error_type': type(e).__name__
            }
    
    async def _test_advanced_claude_features(self, llm_service) -> Dict[str, Any]:
        """Test advanced Claude features"""
        
        results = {}
        
        # Test evidence extraction
        try:
            evidence_test = await llm_service.extract_evidence_structured(
                document_text="This is a randomized controlled trial with n=100 patients studying cancer treatment.",
                document_type="research_paper"
            )
            results['evidence_extraction'] = 'success' if evidence_test else 'failed'
        except Exception as e:
            results['evidence_extraction'] = f'error: {str(e)}'
        
        # Test bias analysis
        try:
            bias_test = await llm_service.analyze_bias_comprehensive(
                evidence_text="This study shows significant improvement in all patients.",
                methodology={"randomization": False},
                results={"p_value": 0.04}
            )
            results['bias_analysis'] = 'success' if bias_test else 'failed'
        except Exception as e:
            results['bias_analysis'] = f'error: {str(e)}'
        
        return results
    
    async def test_openai_api(self) -> Dict[str, Any]:
        """Test OpenAI API"""
        print("\n🔍 Testing OpenAI API...")
        
        if not os.getenv('OPENAI_API_KEY'):
            return {'status': 'skipped', 'reason': 'No API key configured'}
        
        if not SERVICES_AVAILABLE:
            return {'status': 'error', 'reason': 'Service modules not available'}
        
        try:
            start_time = time.time()
            
            llm_service = LLMServiceIntegration()
            test_response = await llm_service.call_openai(
                prompt="This is an API test. Please respond with exactly 'OpenAI API test successful'.",
                system_prompt="You are an API testing assistant.",
                max_tokens=50
            )
            
            response_time = (time.time() - start_time) * 1000
            
            if "openai api test successful" in test_response.content.lower():
                return {
                    'status': 'success',
                    'response_time_ms': int(response_time),
                    'model': test_response.model,
                    'tokens_used': test_response.tokens_used,
                    'confidence': test_response.confidence
                }
            else:
                return {
                    'status': 'error',
                    'reason': f'Unexpected response: {test_response.content[:100]}',
                    'response_time_ms': int(response_time)
                }
                
        except Exception as e:
            return {
                'status': 'error',
                'reason': str(e),
                'error_type': type(e).__name__
            }
    
    async def test_pubmed_api(self) -> Dict[str, Any]:
        """Test PubMed API"""
        print("\n🔍 Testing PubMed API...")
        
        if not SERVICES_AVAILABLE:
            return {'status': 'error', 'reason': 'Service modules not available'}
        
        try:
            start_time = time.time()
            
            api_service = ExternalAPIService()
            test_results = await api_service.search_pubmed(
                query="cancer treatment",
                max_results=3
            )
            
            response_time = (time.time() - start_time) * 1000
            
            if test_results:
                return {
                    'status': 'success',
                    'response_time_ms': int(response_time),
                    'results_count': len(test_results),
                    'api_key_used': bool(os.getenv('PUBMED_API_KEY')),
                    'sample_result': {
                        'title': test_results[0].get('title', 'No title'),
                        'pmid': test_results[0].get('pmid', 'No PMID')
                    } if test_results else None
                }
            else:
                return {
                    'status': 'warning',
                    'reason': 'No results returned',
                    'response_time_ms': int(response_time)
                }
                
        except Exception as e:
            return {
                'status': 'error',
                'reason': str(e),
                'error_type': type(e).__name__
            }
    
    async def test_clinicaltrials_api(self) -> Dict[str, Any]:
        """Test ClinicalTrials.gov API"""
        print("\n🔍 Testing ClinicalTrials.gov API...")
        
        if not SERVICES_AVAILABLE:
            return {'status': 'error', 'reason': 'Service modules not available'}
        
        try:
            start_time = time.time()
            
            api_service = ExternalAPIService()
            test_results = await api_service.search_clinical_trials(
                condition="cancer",
                max_results=3
            )
            
            response_time = (time.time() - start_time) * 1000
            
            if test_results:
                return {
                    'status': 'success',
                    'response_time_ms': int(response_time),
                    'results_count': len(test_results),
                    'sample_result': {
                        'title': test_results[0].get('brief_title', 'No title'),
                        'nct_id': test_results[0].get('nct_id', 'No NCT ID')
                    } if test_results else None
                }
            else:
                return {
                    'status': 'warning',
                    'reason': 'No results returned',
                    'response_time_ms': int(response_time)
                }
                
        except Exception as e:
            return {
                'status': 'error',
                'reason': str(e),
                'error_type': type(e).__name__
            }
    
    async def test_database_connection(self) -> Dict[str, Any]:
        """Test database connectivity"""
        print("\n🔍 Testing Database Connection...")
        
        try:
            import asyncpg
            
            # Extract database connection details
            db_url = os.getenv('DATABASE_URL', '')
            if not db_url:
                return {'status': 'error', 'reason': 'No DATABASE_URL configured'}
            
            # Parse connection URL (basic parsing)
            if 'postgresql' in db_url:
                start_time = time.time()
                
                # Try to connect
                if '+asyncpg' in db_url:
                    # Remove the +asyncpg part for asyncpg connection
                    connection_url = db_url.replace('postgresql+asyncpg', 'postgresql')
                else:
                    connection_url = db_url
                
                conn = await asyncpg.connect(connection_url)
                
                # Test basic query
                result = await conn.fetchval('SELECT 1')
                
                # Test table existence (basic check)
                tables = await conn.fetch("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                """)
                
                await conn.close()
                
                response_time = (time.time() - start_time) * 1000
                
                return {
                    'status': 'success',
                    'response_time_ms': int(response_time),
                    'test_query_result': result,
                    'tables_found': len(tables),
                    'sample_tables': [t['table_name'] for t in tables[:5]]
                }
            else:
                return {'status': 'error', 'reason': 'Unsupported database type'}
                
        except ImportError:
            return {'status': 'error', 'reason': 'asyncpg not available'}
        except Exception as e:
            return {
                'status': 'error',
                'reason': str(e),
                'error_type': type(e).__name__
            }
    
    async def test_redis_connection(self) -> Dict[str, Any]:
        """Test Redis connectivity"""
        print("\n🔍 Testing Redis Connection...")
        
        try:
            import redis.asyncio as redis
            
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            
            start_time = time.time()
            
            # Connect to Redis
            r = redis.from_url(redis_url)
            
            # Test basic operations
            await r.set('afarensis:test', 'connection_test')
            test_value = await r.get('afarensis:test')
            await r.delete('afarensis:test')
            
            # Get Redis info
            info = await r.info()
            
            await r.close()
            
            response_time = (time.time() - start_time) * 1000
            
            return {
                'status': 'success',
                'response_time_ms': int(response_time),
                'test_value_match': test_value.decode() == 'connection_test',
                'redis_version': info.get('redis_version', 'unknown'),
                'memory_usage': info.get('used_memory_human', 'unknown')
            }
            
        except ImportError:
            return {'status': 'error', 'reason': 'redis library not available'}
        except Exception as e:
            return {
                'status': 'error',
                'reason': str(e),
                'error_type': type(e).__name__
            }
    
    async def run_comprehensive_tests(self) -> Dict[str, Any]:
        """Run all API tests"""
        print("🧪 RUNNING COMPREHENSIVE API TESTS")
        print("="*50)
        
        self.load_environment()
        
        # Run all tests concurrently
        test_tasks = [
            ('anthropic', self.test_anthropic_api()),
            ('openai', self.test_openai_api()),
            ('pubmed', self.test_pubmed_api()),
            ('clinicaltrials', self.test_clinicaltrials_api()),
            ('database', self.test_database_connection()),
            ('redis', self.test_redis_connection())
        ]
        
        start_time = time.time()
        
        # Execute tests
        results = {}
        for test_name, test_coro in test_tasks:
            try:
                test_result = await test_coro
                results[test_name] = test_result
            except Exception as e:
                results[test_name] = {
                    'status': 'error',
                    'reason': str(e),
                    'error_type': type(e).__name__
                }
        
        total_time = (time.time() - start_time) * 1000
        
        # Generate summary
        summary = self.generate_test_summary(results, total_time)
        
        return {
            'timestamp': datetime.now().isoformat(),
            'total_time_ms': int(total_time),
            'test_results': results,
            'summary': summary
        }
    
    def generate_test_summary(self, results: Dict[str, Any], total_time_ms: int) -> Dict[str, Any]:
        """Generate test summary statistics"""
        
        total_tests = len(results)
        successful = sum(1 for r in results.values() if r['status'] == 'success')
        warnings = sum(1 for r in results.values() if r['status'] == 'warning')
        errors = sum(1 for r in results.values() if r['status'] == 'error')
        skipped = sum(1 for r in results.values() if r['status'] == 'skipped')
        
        # Calculate average response times for successful tests
        response_times = [r.get('response_time_ms', 0) for r in results.values() 
                         if r['status'] == 'success' and 'response_time_ms' in r]
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0
        
        return {
            'total_tests': total_tests,
            'successful': successful,
            'warnings': warnings,
            'errors': errors,
            'skipped': skipped,
            'success_rate': (successful / total_tests) * 100 if total_tests > 0 else 0,
            'total_time_ms': total_time_ms,
            'avg_response_time_ms': int(avg_response_time),
            'overall_status': self.determine_overall_status(successful, warnings, errors, total_tests)
        }
    
    def determine_overall_status(self, successful: int, warnings: int, errors: int, total: int) -> str:
        """Determine overall test status"""
        if errors > 0:
            return 'critical' if errors > successful else 'degraded'
        elif warnings > 0:
            return 'warning'
        elif successful == total:
            return 'healthy'
        else:
            return 'unknown'
    
    def print_test_report(self, results: Dict[str, Any]):
        """Print formatted test report"""
        print("\n" + "="*50)
        print("🧪 API TEST REPORT")
        print("="*50)
        
        summary = results['summary']
        
        # Overall status
        status_icons = {
            'healthy': '🟢',
            'warning': '🟡',
            'degraded': '🟠',
            'critical': '🔴',
            'unknown': '⚪'
        }
        
        print(f"\n{status_icons[summary['overall_status']]} Overall Status: {summary['overall_status'].upper()}")
        print(f"✅ Success Rate: {summary['success_rate']:.1f}% ({summary['successful']}/{summary['total_tests']})")
        print(f"⏱️  Total Test Time: {summary['total_time_ms']:.0f}ms")
        print(f"📊 Average Response Time: {summary['avg_response_time_ms']:.0f}ms")
        
        # Individual test results
        print("\n📋 Individual Test Results:")
        for test_name, result in results['test_results'].items():
            status = result['status']
            icon = '✅' if status == 'success' else '⚠️' if status == 'warning' else '❌' if status == 'error' else '⏭️'
            
            print(f"\n  {icon} {test_name.upper()}:")
            print(f"     Status: {status}")
            
            if 'response_time_ms' in result:
                print(f"     Response Time: {result['response_time_ms']}ms")
            
            if result['status'] == 'success':
                if 'model' in result:
                    print(f"     Model: {result['model']}")
                if 'results_count' in result:
                    print(f"     Results: {result['results_count']} found")
                if 'tables_found' in result:
                    print(f"     Database Tables: {result['tables_found']}")
            elif result['status'] in ['error', 'warning']:
                print(f"     Issue: {result.get('reason', 'Unknown')}")
            elif result['status'] == 'skipped':
                print(f"     Reason: {result.get('reason', 'Not configured')}")
        
        # Recommendations
        print("\n🎯 Recommendations:")
        recommendations = []
        
        for test_name, result in results['test_results'].items():
            if result['status'] == 'error':
                if test_name == 'anthropic':
                    recommendations.append("🔧 Fix Claude API: Check ANTHROPIC_API_KEY and account credits")
                elif test_name == 'openai':
                    recommendations.append("🔧 Fix OpenAI API: Check OPENAI_API_KEY and account credits")
                elif test_name == 'database':
                    recommendations.append("🔧 Fix Database: Ensure PostgreSQL is running and accessible")
                elif test_name == 'redis':
                    recommendations.append("🔧 Fix Redis: Ensure Redis server is running")
            elif result['status'] == 'skipped':
                if test_name == 'openai':
                    recommendations.append("💡 Consider adding OpenAI API key for LLM redundancy")
        
        if not recommendations:
            recommendations.append("🎉 All systems operational!")
        
        for rec in recommendations:
            print(f"  {rec}")
        
        print(f"\n📝 Report generated: {results['timestamp']}")


def save_test_report(results: Dict[str, Any], filename: str = None):
    """Save test results to JSON file"""
    if not filename:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"api_test_report_{timestamp}.json"
    
    with open(filename, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"📁 Test report saved to: {filename}")


async def main():
    """Main testing function"""
    tester = APITester()
    
    try:
        # Run tests
        results = await tester.run_comprehensive_tests()
        
        # Print report
        tester.print_test_report(results)
        
        # Save report if requested
        if len(sys.argv) > 1 and sys.argv[1] == '--save':
            save_test_report(results)
        
        # Exit with appropriate code
        summary = results['summary']
        if summary['overall_status'] in ['healthy', 'warning']:
            sys.exit(0)
        else:
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n❌ Testing cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Testing failed: {str(e)}")
        logger.exception("API testing failed")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
