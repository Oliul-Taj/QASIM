import { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { fetchAndParseCSV, fetchGeoJSON, calculateDistrictHeuristics, calculatePriorityDistricts } from '../utils/engine';

const EngineContext = createContext();

export const EngineProvider = ({ children }) => {
  const [nationalData, setNationalData] = useState([]);
  const [mvtWeights, setMvtWeights] = useState([]);
  const [geojsonData, setGeojsonData] = useState(null);
  const [districtData, setDistrictData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [activeYear, setActiveYear] = useState(2025);

  const [targetConnectivity, setTargetConnectivity] = useState(80);
  const [timeframe, setTimeframe] = useState(5);
  const [budget, setBudget] = useState(500);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [roadmap, setRoadmap] = useState([]);

  const [baselineIndicators, setBaselineIndicators] = useState({});
  const [sandboxMultipliers, setSandboxMultipliers] = useState({});
  const [baselineDistrictData, setBaselineDistrictData] = useState([]);

  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [analysisData, setAnalysisData] = useState(null);
  const [priorityDistricts, setPriorityDistricts] = useState(new Set());
  const [isDirty, setIsDirty] = useState(false);
  const [reportsHistory, setReportsHistory] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [nationalRes, mvtRes, geoRes] = await Promise.all([
          fetchAndParseCSV('/data/master_engine_data.csv'),
          fetchAndParseCSV('/data/mvt_weights.csv'),
          fetchGeoJSON('/data/bangladesh.geojson')
        ]);

        setNationalData(nationalRes);
        const validWeights = mvtRes.filter(w => w.token && w.weight !== undefined);
        setMvtWeights(validWeights);
        setGeojsonData(geoRes);

        if (nationalRes && nationalRes.length > 0) {
          const latestData = nationalRes[nationalRes.length - 1];
          setBaselineIndicators(latestData);

          const initialMultipliers = {};
          validWeights.forEach(w => {
            if (latestData[w.token] !== undefined) initialMultipliers[w.token] = 1.0;
          });
          setSandboxMultipliers(initialMultipliers);

          if (geoRes && geoRes.features) {
            const dData = calculateDistrictHeuristics(latestData, initialMultipliers, validWeights, geoRes, 80);
            setDistrictData(dData);
            setBaselineDistrictData(dData);
          }
        }
      } catch (error) {
        console.error("Failed to load engine data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const recalcDistricts = useCallback((multipliers, target) => {
    if (!geojsonData || !mvtWeights.length) return;
    const dData = calculateDistrictHeuristics(baselineIndicators, multipliers, mvtWeights, geojsonData, target);
    setDistrictData(dData);
    if (analysisComplete) setIsDirty(true);
  }, [geojsonData, mvtWeights, baselineIndicators, analysisComplete]);

  const handleTargetChange = useCallback((val) => {
    setTargetConnectivity(val);
    recalcDistricts(sandboxMultipliers, val);
  }, [sandboxMultipliers, recalcDistricts]);

  const handleTimeframeChange = useCallback((val) => {
    setTimeframe(val);
    if (analysisComplete) setIsDirty(true);
  }, [analysisComplete]);

  const handleBudgetChange = useCallback((val) => {
    setBudget(val);
    if (analysisComplete) setIsDirty(true);
  }, [analysisComplete]);

  const updateIndicatorMultiplier = useCallback((token, multiplier) => {
    const newMultipliers = { ...sandboxMultipliers, [token]: multiplier };
    setSandboxMultipliers(newMultipliers);
    recalcDistricts(newMultipliers, targetConnectivity);
    if (selectedDistrict) {
      const updated = districtData.find(d => d.name === selectedDistrict.name);
      if (updated) setSelectedDistrict(updated);
    }
  }, [sandboxMultipliers, targetConnectivity, recalcDistricts, selectedDistrict, districtData]);

  const resetSandbox = useCallback(() => {
    const resets = {};
    Object.keys(sandboxMultipliers).forEach(k => resets[k] = 1.0);
    setSandboxMultipliers(resets);
    recalcDistricts(resets, targetConnectivity);
  }, [sandboxMultipliers, targetConnectivity, recalcDistricts]);

  const runAnalysis = useCallback(async () => {
    if (analysisRunning) return;

    setAnalysisRunning(true);
    setAnalysisComplete(false);
    setIsDirty(false);
    setPriorityDistricts(new Set());
    setAnalysisData(null);
    setAnalysisStatus('');

    try {
      setAnalysisStatus('📊 Analyzing national trends (2000–2025)...');
      await new Promise(r => setTimeout(r, 600));

      const res = await fetch('http://localhost:5000/api/analyze');
      const data = await res.json();

      setAnalysisStatus('🗺️ Breaking down by division...');
      await new Promise(r => setTimeout(r, 500));

      setAnalysisStatus('📍 Disaggregating to district level...');
      await new Promise(r => setTimeout(r, 500));

      setAnalysisData(data);

      setAnalysisStatus('⚡ Calculating priority districts...');
      await new Promise(r => setTimeout(r, 400));

      const priority = calculatePriorityDistricts(districtData, targetConnectivity, timeframe);
      setPriorityDistricts(priority);

      setAnalysisStatus('✅ Analysis complete');
      setAnalysisComplete(true);
    } catch (err) {
      console.warn('Backend offline, using local fallback:', err);
      setAnalysisStatus('⚠️ Using local data (backend offline)');
      const priority = calculatePriorityDistricts(districtData, targetConnectivity, timeframe);
      setPriorityDistricts(priority);
      setAnalysisComplete(true);
    } finally {
      setAnalysisRunning(false);
    }
  }, [analysisRunning, districtData, targetConnectivity, timeframe]);

  const sandboxImpact = useMemo(() => {
    if (!baselineDistrictData.length || !districtData.length)
      return { avgDelta: 0, redDelta: 0, greenDelta: 0, projectedAvg: 0 };

    const baseAvg = baselineDistrictData.reduce((a, d) => a + d.connectivity, 0) / baselineDistrictData.length;
    const currAvg = districtData.reduce((a, d) => a + d.connectivity, 0) / districtData.length;
    const baseRed = baselineDistrictData.filter(d => d.status === 'red').length;
    const currRed = districtData.filter(d => d.status === 'red').length;
    const baseGreen = baselineDistrictData.filter(d => d.status === 'green').length;
    const currGreen = districtData.filter(d => d.status === 'green').length;

    return {
      avgDelta: parseFloat((currAvg - baseAvg).toFixed(2)),
      redDelta: currRed - baseRed,
      greenDelta: currGreen - baseGreen,
      projectedAvg: parseFloat(currAvg.toFixed(2)),
    };
  }, [districtData, baselineDistrictData]);

  return (
    <EngineContext.Provider value={{
      nationalData, mvtWeights, geojsonData, districtData, loading,
      targetConnectivity, setTargetConnectivity: handleTargetChange,
      timeframe, setTimeframe: handleTimeframeChange,
      budget, setBudget: handleBudgetChange,
      selectedDistrict, setSelectedDistrict, roadmap, setRoadmap,
      baselineIndicators, sandboxMultipliers, updateIndicatorMultiplier, resetSandbox,
      sandboxImpact, baselineDistrictData,
      analysisComplete, analysisRunning, analysisStatus, analysisData, priorityDistricts,
      runAnalysis,
      darkMode, setDarkMode,
      activeYear, setActiveYear,
      isDirty, reportsHistory, setReportsHistory
    }}>
      {children}
    </EngineContext.Provider>
  );
};

export const useEngine = () => useContext(EngineContext);
