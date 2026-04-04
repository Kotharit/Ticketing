class TriageService
  def self.get_base_urgency(type)
    critical = ['Water leak', 'Sewage / flooding', 'Fire or safety hazard', 'Gas leak']
    high = ['Electricity problem', 'Elevator issue', 'Broken door / window', 'Pest / insects']
    medium = ['AC not working', 'Plumbing issue', 'Broken window / latch']
    
    return 'critical' if critical.include?(type)
    return 'high' if high.include?(type)
    return 'medium' if medium.include?(type)
    'low'
  end

  def self.smart_triage(type, description)
    level = get_base_urgency(type)
    desc = (description || '').downcase
    levels = { 'critical' => 4, 'high' => 3, 'medium' => 2, 'low' => 1 }

    critical_words = ['flooding','fire','smoke','gas smell','emergency','dangerous','unsafe','collapsed','electrocution','sparks','explosion','short circuit','burning','suffocating','toxic','unconscious']
    high_words = ['broken','not working','leaking','sewage','smell','stuck','trapped','no water','no electricity','blackout','overflowing','cracked','shattered','major','severe','urgent']

    hit_critical = critical_words.select { |w| desc.include?(w) }
    hit_high = high_words.select { |w| desc.include?(w) }

    reason_str = "Category: #{type.presence || 'Other'} → #{level.capitalize}"

    if hit_critical.any? && levels[level] < 4
      level = 'critical'
      reason_str += " | ⚠️ Escalated by keywords: #{hit_critical.join(', ')}"
    elsif hit_high.any? && levels[level] < 3
      level = 'high'
      reason_str += " | ↑ Boosted by keywords: #{hit_high.join(', ')}"
    end

    { level: level, reason: reason_str }
  end
end
