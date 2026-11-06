import { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';

export function useDashboardData() {
  const [stats, setStats] = useState(null)
  const [liveMatches, setLiveMatches] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [penaltyPolicy, setPenaltyPolicy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      try {
        setLoading(true)
        const [statsData, matchesData, tourneysData, policyData] = await Promise.all([
          dataService.fetchDashboardStats(),
          dataService.fetchLiveMatches(),
          dataService.fetchTournaments(),
          dataService.fetchCategoryQPolicy()
        ])

        if (isMounted) {
          setStats(statsData)
          setLiveMatches(matchesData)
          setTournaments(tourneysData)
          setPenaltyPolicy(policyData)
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load dashboard data')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [])

  return { stats, liveMatches, tournaments, penaltyPolicy, loading, error }
}

