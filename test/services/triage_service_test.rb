require "test_helper"

class TriageServiceTest < ActiveSupport::TestCase
  # --- Category-based urgency ---

  test "water leak maps to critical" do
    assert_equal "critical", TriageService.get_base_urgency("Water leak")
  end

  test "sewage flooding maps to critical" do
    assert_equal "critical", TriageService.get_base_urgency("Sewage / flooding")
  end

  test "fire or safety hazard maps to critical" do
    assert_equal "critical", TriageService.get_base_urgency("Fire or safety hazard")
  end

  test "gas leak maps to critical" do
    assert_equal "critical", TriageService.get_base_urgency("Gas leak")
  end

  test "electricity problem maps to high" do
    assert_equal "high", TriageService.get_base_urgency("Electricity problem")
  end

  test "elevator issue maps to high" do
    assert_equal "high", TriageService.get_base_urgency("Elevator issue")
  end

  test "AC not working maps to medium" do
    assert_equal "medium", TriageService.get_base_urgency("AC not working")
  end

  test "unknown type maps to low" do
    assert_equal "low", TriageService.get_base_urgency("Noise complaint")
  end

  test "empty type maps to low" do
    assert_equal "low", TriageService.get_base_urgency("")
  end

  # --- Keyword escalation ---

  test "critical keyword escalates low to critical" do
    result = TriageService.smart_triage("Other", "There is flooding in the basement")
    assert_equal "critical", result[:level]
    assert_includes result[:reason], "Escalated by keywords"
    assert_includes result[:reason], "flooding"
  end

  test "high keyword escalates low to high" do
    result = TriageService.smart_triage("Other", "The pipe is leaking badly")
    assert_equal "high", result[:level]
    assert_includes result[:reason], "Boosted by keywords"
  end

  test "critical keyword does not downgrade already critical" do
    result = TriageService.smart_triage("Water leak", "normal description")
    assert_equal "critical", result[:level]
    assert_not_includes result[:reason], "Escalated"
  end

  test "high keyword does not downgrade already high" do
    result = TriageService.smart_triage("Electricity problem", "something broken")
    assert_equal "high", result[:level]
    assert_not_includes result[:reason], "Boosted"
  end

  test "no keywords keeps baseline urgency" do
    result = TriageService.smart_triage("AC not working", "temperature is slightly warm")
    assert_equal "medium", result[:level]
    assert_not_includes result[:reason], "Escalated"
    assert_not_includes result[:reason], "Boosted"
  end

  test "nil description does not crash" do
    result = TriageService.smart_triage("Other", nil)
    assert_equal "low", result[:level]
    assert_includes result[:reason], "Category: Other"
  end

  test "reason includes category information" do
    result = TriageService.smart_triage("Plumbing issue", "minor drip")
    assert_includes result[:reason], "Category: Plumbing issue"
    assert_includes result[:reason], "Medium"
  end
end
