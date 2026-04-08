require "test_helper"

class SheetSerializerTest < ActiveSupport::TestCase
  test "serialize empty array returns bracket string" do
    assert_equal "[]", SheetSerializer.serialize_attachments([])
  end

  test "serialize nil returns bracket string" do
    assert_equal "[]", SheetSerializer.serialize_attachments(nil)
  end

  test "parse empty string returns empty array" do
    assert_equal [], SheetSerializer.parse_attachments("")
  end

  test "parse nil returns empty array" do
    assert_equal [], SheetSerializer.parse_attachments(nil)
  end

  test "parse invalid JSON returns empty array" do
    assert_equal [], SheetSerializer.parse_attachments("not json at all")
  end

  test "round-trip preserves drive attachments" do
    attachments = [
      { "id" => "drv_abc123", "name" => "photo.jpg", "mimeType" => "image/jpeg" }
    ]

    serialized  = SheetSerializer.serialize_attachments(attachments)
    parsed      = SheetSerializer.parse_attachments(serialized)

    assert_equal attachments, parsed
  end

  test "round-trip preserves local attachments" do
    attachments = [
      { "id" => "loc_uuid.png", "name" => "screenshot.png" }
    ]

    serialized  = SheetSerializer.serialize_attachments(attachments)
    parsed      = SheetSerializer.parse_attachments(serialized)

    assert_equal attachments, parsed
  end

  test "round-trip preserves multiple attachments" do
    attachments = [
      { "id" => "drv_abc", "name" => "a.jpg", "mimeType" => "image/jpeg" },
      { "id" => "loc_def.png", "name" => "b.png" }
    ]

    serialized  = SheetSerializer.serialize_attachments(attachments)
    parsed      = SheetSerializer.parse_attachments(serialized)

    assert_equal attachments, parsed
  end

  test "serialized output includes human-readable links section" do
    attachments = [
      { "id" => "drv_xyz", "name" => "invoice.pdf", "mimeType" => "application/pdf" }
    ]

    serialized = SheetSerializer.serialize_attachments(attachments)

    assert_includes serialized, "---LINKS---"
    assert_includes serialized, "https://drive.google.com/open?id=xyz"
  end

  test "parse strips links section from serialized data" do
    raw = '[{"id":"drv_test","name":"file.jpg"}]' + "\n\n---LINKS---\nhttps://drive.google.com/open?id=test"
    parsed = SheetSerializer.parse_attachments(raw)

    assert_equal 1, parsed.length
    assert_equal "drv_test", parsed[0]["id"]
  end
end
