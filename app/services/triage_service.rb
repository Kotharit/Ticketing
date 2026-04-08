# Triage engine that assigns urgency levels to tickets.
#
# Uses a two-layer approach:
#   1. Category-based baseline (e.g., "Water leak" → critical)
#   2. Keyword escalation from the description text (e.g., "flooding" → bump to critical)
#
# The reason string is stored with the ticket so admins can see
# WHY a ticket was assigned its urgency level.
class TriageService
  # Categories grouped by baseline urgency level
  URGENCY_CATEGORIES = {
    'critical' => ['Water leak', 'Sewage / flooding', 'Fire or safety hazard', 'Gas leak'],
    'high'     => ['Electricity problem', 'Elevator issue', 'Broken door / window', 'Pest / insects'],
    'medium'   => ['AC not working', 'Plumbing issue', 'Broken window / latch']
  }.freeze

  # Numeric values for comparing urgency levels
  URGENCY_RANK = { 'critical' => 4, 'high' => 3, 'medium' => 2, 'low' => 1 }.freeze

  # Keywords that can escalate a ticket above its category baseline
  CRITICAL_KEYWORDS = %w[
    flooding fire smoke gas\ smell emergency dangerous unsafe collapsed
    electrocution sparks explosion short\ circuit burning suffocating toxic unconscious
  ].freeze

  HIGH_KEYWORDS = %w[
    broken not\ working leaking sewage smell stuck trapped no\ water
    no\ electricity blackout overflowing cracked shattered major severe urgent
  ].freeze

  def self.get_base_urgency(type)
    URGENCY_CATEGORIES.each do |level, categories|
      return level if categories.include?(type)
    end
    'low'
  end

  def self.smart_triage(type, description)
    level      = get_base_urgency(type)
    desc_lower = (description || '').downcase

    hit_critical = CRITICAL_KEYWORDS.select { |w| desc_lower.include?(w) }
    hit_high     = HIGH_KEYWORDS.select { |w| desc_lower.include?(w) }

    reason = "Category: #{type.presence || 'Other'} → #{level.capitalize}"

    if hit_critical.any? && URGENCY_RANK[level] < URGENCY_RANK['critical']
      level = 'critical'
      reason += " | ⚠️ Escalated by keywords: #{hit_critical.join(', ')}"
    elsif hit_high.any? && URGENCY_RANK[level] < URGENCY_RANK['high']
      level = 'high'
      reason += " | ↑ Boosted by keywords: #{hit_high.join(', ')}"
    end

    { level: level, reason: reason }
  end
end
