// src/utils/time.js

/**
 * Parse a time string like "2:55 pm" or "10:25 am" into 24-hour format
 * @param {string} timeStr - Time string to parse
 * @returns {{ hours: number, minutes: number }} Parsed hours and minutes
 * @throws {Error} If time format is invalid
 */
function parseTimeString(timeStr) {
    if (!timeStr) {
      throw new Error('Time string is required');
    }
  
    const [time, period] = timeStr.toLowerCase().trim().split(' ');
    if (!time || !period) {
      throw new Error('Invalid time format. Example: "2:55 pm" or "10:25 am"');
    }
  
    let [hours, minutes] = time.split(':').map(Number);
  
    // Validate inputs
    if (isNaN(hours) || isNaN(minutes) || 
        hours < 1 || hours > 12 || 
        minutes < 0 || minutes > 59 || 
        !['am', 'pm'].includes(period)) {
      throw new Error('Invalid time format. Hours: 1-12, Minutes: 0-59, Period: am/pm');
    }
  
    // Convert to 24-hour format
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
  
    return { hours, minutes };
  }
  
  /**
   * Convert a local time to UTC, given the user's current local time
   * @param {string} localTime - Desired local time (ex: "10:25 am")
   * @param {string} currentTime - User's current local time (ex: "2:55 pm")
   * @returns {{ hours: number, minutes: number }} UTC time
   */
  function convertToUTC(localTime, currentTime) {
    const { hours: userCurrentHours } = parseTimeString(currentTime);
    const { hours: desiredHours, minutes: desiredMinutes } = parseTimeString(localTime);
  
    // Calculate offset from UTC
    const now = new Date();
    const currentUTCHours = now.getUTCHours();
    const userOffset = userCurrentHours - currentUTCHours;
  
    // Convert desired time to UTC
    let utcHours = desiredHours - userOffset;
    
    // Handle day wraparound
    if (utcHours < 0) utcHours += 24;
    if (utcHours >= 24) utcHours -= 24;
  
    return { hours: utcHours, minutes: desiredMinutes };
  }
  
  /**
   * Format time in HH:mm format with optional period (AM/PM)
   * @param {number} hours - Hours in 24-hour format
   * @param {number} minutes - Minutes
   * @param {boolean} [includePeriod=false] - Whether to include AM/PM
   * @returns {string} Formatted time
   */
  function formatTime(hours, minutes, includePeriod = false) {
    if (typeof hours !== 'number' || typeof minutes !== 'number') {
      throw new Error('Hours and minutes must be numbers');
    }
  
    const paddedHours = String(hours).padStart(2, '0');
    const paddedMinutes = String(minutes).padStart(2, '0');
    
    if (!includePeriod) {
      return `${paddedHours}:${paddedMinutes}`;
    }
  
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${paddedMinutes} ${period}`;
  }
  
  /**
   * Get the current week number and date range
   * @returns {{ weekNumber: number, startDate: Date, endDate: Date }}
   */
  function getCurrentWeek() {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 4); // Friday
  
    // Calculate week number
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
    const pastDaysOfYear = (now - firstDayOfYear) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  
    return { weekNumber, startDate: startOfWeek, endDate: endOfWeek };
  }
  
  /**
   * Validate time string format
   * @param {string} timeStr - Time string to validate
   * @returns {boolean} Whether the time string is valid
   */
  function isValidTime(timeStr) {
    try {
      parseTimeString(timeStr);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Calculate local time based on UTC time and offset
   * @param {string} utcTime - UTC time in HH:mm format
   * @param {number} offsetHours - Hours to offset (positive or negative)
   * @returns {string} Local time in HH:mm format
   */
  function calculateLocalTime(utcTime, offsetHours) {
    const [hours, minutes] = utcTime.split(':').map(Number);
    
    let localHours = hours + offsetHours;
    if (localHours < 0) localHours += 24;
    if (localHours >= 24) localHours -= 24;
  
    return formatTime(localHours, minutes);
  }
  
  module.exports = {
    parseTimeString,
    convertToUTC,
    formatTime,
    getCurrentWeek,
    isValidTime,
    calculateLocalTime
  };