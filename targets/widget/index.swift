import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let entries: [SimpleEntry] = [SimpleEntry(date: Date())]
        let timeline = Timeline(entries: entries, policy: .never)
        completion(timeline)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
}

struct WidgetEntryView : View {
    var entry: Provider.Entry

    var body: some View {
        // Deep link into the app to add a new note
        let addUrl = URL(string: "obsidiannotes://add")!
        
        VStack {
            Image(systemName: "square.and.pencil")
                .font(.system(size: 32, weight: .semibold))
                .foregroundColor(Color(red: 98/255, green: 0, blue: 238/255)) // #6200EE approx
                .padding(.bottom, 2)
            
            Text("New Note")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.primary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // Full-tap area for small widgets
        .widgetURL(addUrl)
        // iOS 17+ requires containerBackground API instead of coloring a ZStack
        .containerBackground(for: .widget) {
            Color(red: 240/255, green: 242/255, blue: 245/255) // #F0F2F5 approx
        }
    }
}

@main
struct NotesWidget: Widget {
    let kind: String = "NotesWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            WidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Quick Add")
        .description("Add a new note quickly.")
        .supportedFamilies([.systemSmall])
    }
}
